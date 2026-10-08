import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import {
  createCanvas,
  DOMMatrix as NapiDOMMatrix,
  DOMPoint as NapiDOMPoint,
  Path2D as NapiPath2D,
} from '@napi-rs/canvas';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface ExtractionResult {
  text: string;
  confidence?: number;
  method: 'pdf' | 'docx' | 'txt' | 'ocr';
}

const SUPPORTED_IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp'];
const SUPPORTED_TEXT_TYPES = ['txt', 'csv', 'md'];

const execFileAsync = promisify(execFile);

/**
 * Lazy-load pdf.js. pdf.js's Node build tries to `require('canvas')` unless the
 * DOMMatrix/Path2D/DOMPoint globals already exist, so we seed them from
 * `@napi-rs/canvas` first to avoid requiring the (unavailable) node-canvas.
 */
let pdfjsModule: any = null;
export function loadPdfjs(): any {
  if (pdfjsModule) return pdfjsModule;
  const g = globalThis as Record<string, any>;
  if (!g.DOMMatrix && NapiDOMMatrix) g.DOMMatrix = NapiDOMMatrix;
  if (!g.DOMPoint && NapiDOMPoint) g.DOMPoint = NapiDOMPoint;
  if (!g.Path2D && NapiPath2D) g.Path2D = NapiPath2D;
   
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pdfjsModule = require('pdfjs-dist/legacy/build/pdf.js');
  return pdfjsModule;
}

/**
 * Canvas factory backed by @napi-rs/canvas so pdf.js renders pages without
 * depending on node-canvas.
 */
export class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(ctx: any, width: number, height: number, resetTransform?: boolean) {
    const canvas = ctx.canvas;
    canvas.width = width;
    canvas.height = height;
    if (resetTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  destroy(ctx: any) {
    if (ctx && ctx.canvas) ctx.canvas.width = 0;
  }
}

export function cleanExtractedText(text: string): string {
  if (!text) return '';

  // 1. Merge runs of single-character or short-fragment lines from vertical/multi-column PDF tables
  let cleaned = text.replace(/(?:(?:^[ \t]*[^\s\r\n]{1,2}[ \t]*\r?\n){2,})/gm, (match) => {
    const tokens = match
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let joined = '';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const nextTok = tokens[i + 1];
      joined += tok;
      if (
        nextTok &&
        (/[A-Z0-9]$/.test(tok) && /^[A-Z]/.test(nextTok) && tok.length > 1)
      ) {
        joined += ' ';
      }
    }
    return joined + '\n';
  });

  // 2. Fix broken single letter newlines inside words (e.g. "R\ne\ng\nn" -> "Regn")
  cleaned = cleaned.replace(/([a-zA-Z0-9])\r?\n([a-zA-Z0-9])/g, '$1$2');

  // 3. Clean line whitespace and filter out standalone vertical debris
  const lines = cleaned.split(/\r?\n/);
  const formattedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.replace(/[ \t]+/g, ' ').trim();
    if (trimmed) {
      formattedLines.push(trimmed);
    }
  }

  return formattedLines.join('\n');
}

export class TextExtractor {
  private ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

  private tempFilePath(ext: string): string {
    return path.join(os.tmpdir(), `cc_ocr_${crypto.randomBytes(8).toString('hex')}.${ext}`);
  }

  /**
   * Primary OCR path: renders PDF pages / preprocesses images and runs the
   * system Tesseract binary via `server/python/ocr_extract.py`. Returns null
   * when the engine is unavailable or yields no usable text, so callers can
   * fall back to tesseract.js.
   */
  private async ocrViaPython(filePath: string): Promise<{ text: string; confidence?: number; pages?: number } | null> {
    const script = config.ocr.scriptPath;
    if (!script || !fs.existsSync(script)) return null;

    const parts = config.ocr.pythonExe.split(/\s+/).filter(Boolean);
    if (!parts.length) return null;

    const args = [
      ...parts.slice(1),
      script,
      '--input',
      filePath,
      '--dpi',
      String(config.ocr.dpi),
      '--psm',
      '3',
      '--preprocess',
      'otsu',
    ];

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (!env.TESSERACT_CMD && config.ocr.tesseractCmd) env.TESSERACT_CMD = config.ocr.tesseractCmd;

    try {
      const { stdout } = await execFileAsync(parts[0], args, {
        timeout: config.ocr.timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        env,
        windowsHide: true,
      });
      const parsed = JSON.parse(stdout.trim());
      if (parsed.error) {
        logger.warn(`Python OCR engine error: ${parsed.error}`);
        return null;
      }
      const text = cleanExtractedText(parsed.text || '');
      if (!text) return null;
      return { text, confidence: parsed.confidence || undefined, pages: parsed.pages };
    } catch (err) {
      logger.warn(`Python OCR invocation failed, falling back to tesseract.js: ${(err as Error).message}`);
      return null;
    }
  }

  private getFileExtension(filePath: string): string {
    return path.extname(filePath).replace('.', '').toLowerCase();
  }

  async extract(filePath: string, fileType?: string): Promise<ExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = (fileType || this.getFileExtension(filePath)).toLowerCase();

    if (ext === 'pdf') {
      return this.extractFromPDF(filePath);
    }

    if (ext === 'docx') {
      return this.extractFromDocx(filePath);
    }

    if (ext === 'doc') {
      // Legacy binary Word format: not extractable by mammoth.
      logger.warn(`Legacy .doc file detected (unsupported): ${filePath}`);
      return { text: '', method: 'docx' };
    }

    if (SUPPORTED_TEXT_TYPES.includes(ext)) {
      return this.extractFromTextFile(filePath);
    }

    if (SUPPORTED_IMAGE_TYPES.includes(ext)) {
      return this.extractFromImage(filePath);
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }

  async extractFromBuffer(buffer: Buffer, fileType: string): Promise<ExtractionResult> {
    const ext = (fileType || '').replace('.', '').toLowerCase();

    if (ext === 'pdf') {
      try {
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 0) {
          return {
            text: cleanExtractedText(data.text),
            method: 'pdf',
          };
        }
        // Image-only / scanned PDF: fall back to OCR
        return this.ocrScannedPdf(buffer);
      } catch (err) {
        logger.error('PDF buffer extraction failed, falling back to OCR:', err);
        return this.ocrScannedPdf(buffer);
      }
    }

    if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return {
          text: cleanExtractedText(result.value || ''),
          method: 'docx',
        };
      } catch (err) {
        logger.error('DOCX buffer extraction failed:', err);
        return { text: '', method: 'docx' };
      }
    }

    if (SUPPORTED_TEXT_TYPES.includes(ext)) {
      return {
        text: cleanExtractedText(buffer.toString('utf-8')),
        method: 'txt',
      };
    }

    if (SUPPORTED_IMAGE_TYPES.includes(ext)) {
      try {
        const tmpPath = this.tempFilePath(ext);
        fs.writeFileSync(tmpPath, buffer);
        try {
          const py = await this.ocrViaPython(tmpPath);
          if (py) {
            return {
              text: py.text,
              confidence: py.confidence || 0,
              method: 'ocr',
            };
          }
          if (!this.ocrWorker) {
            await this.initOCRWorker();
          }
          const { data } = await this.ocrWorker!.recognize(tmpPath);
          return {
            text: cleanExtractedText(data.text || ''),
            confidence: data.confidence || 0,
            method: 'ocr',
          };
        } finally {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        logger.error('Image buffer OCR failed:', err);
        return { text: '', method: 'ocr' };
      }
    }

    return { text: '', method: 'txt' };
  }

  async extractFromDocx(filePath: string): Promise<ExtractionResult> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const rawText = (result.value || '').trim();

      if (!rawText) {
        logger.warn('Empty DOCX text detected:', filePath);
        return { text: '', method: 'docx' };
      }

      return {
        text: cleanExtractedText(rawText),
        method: 'docx',
      };
    } catch (err) {
      logger.error(`DOCX extraction failed for ${filePath}:`, err);
      throw new Error(`Failed to extract text from DOCX: ${err}`);
    }
  }

  async extractFromTextFile(filePath: string): Promise<ExtractionResult> {
    try {
      const rawText = fs.readFileSync(filePath, 'utf8').trim();
      return {
        text: cleanExtractedText(rawText),
        method: 'txt',
      };
    } catch (err) {
      logger.error(`Text file extraction failed for ${filePath}:`, err);
      throw new Error(`Failed to extract text from file: ${err}`);
    }
  }

  async extractFromPDF(filePath: string): Promise<ExtractionResult> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      if (!data.text || data.text.trim().length === 0) {
        // Handle scanned PDFs by OCR'ing each page (Python engine first).
        logger.info('Empty PDF text detected, attempting OCR on pages');
        return this.extractScannedPDF(filePath);
      }

      return {
        text: cleanExtractedText(data.text),
        method: 'pdf',
      };
    } catch (err) {
      logger.error(`PDF extraction failed for ${filePath}:`, err);
      throw new Error(`Failed to extract text from PDF: ${err}`);
    }
  }

  private async extractScannedPDF(filePath: string): Promise<ExtractionResult> {
    logger.info(`Scanned PDF detected without extractable text: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    return this.ocrScannedPdf(dataBuffer);
  }

  /**
   * OCR an image-only / scanned PDF. Tries the Python Tesseract engine first
   * (PyMuPDF render at high DPI), then falls back to rendering each page with
   * pdf.js and running tesseract.js per page.
   */
  private async ocrScannedPdf(pdfBuffer: Buffer): Promise<ExtractionResult> {
    const tmpPath = this.tempFilePath('pdf');
    fs.writeFileSync(tmpPath, pdfBuffer);
    try {
      const py = await this.ocrViaPython(tmpPath);
      if (py) {
        logger.info(
          `Python OCR'd scanned PDF: ${py.pages ?? '?'} pages, ${py.text.length} chars, conf=${py.confidence ?? '-'}`
        );
        return {
          text: py.text,
          confidence: py.confidence,
          method: 'ocr',
        };
      }
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }

    try {
      const pdfjs = loadPdfjs();
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(pdfBuffer),
        isEvalSupported: false,
        canvasFactory: new NapiCanvasFactory(),
      });
      const doc = await loadingTask.promise;
      const numPages = doc.numPages;

      const pageTexts: string[] = [];
      let totalConfidence = 0;
      let recognizedPages = 0;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        try {
          const viewport = page.getViewport({ scale: 2 });
          const width = Math.max(1, Math.ceil(viewport.width));
          const height = Math.max(1, Math.ceil(viewport.height));

          const canvas = createCanvas(width, height);
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);

          await page.render({
            canvasContext: context as any,
            viewport,
            canvasFactory: new NapiCanvasFactory(),
            background: '#ffffff',
          } as any).promise;

          const pngBuffer = canvas.toBuffer('image/png');
          const worker = await this.ensureOcrWorker();
          const { data } = await worker.recognize(pngBuffer);
          if (data.text && data.text.trim()) {
            pageTexts.push(cleanExtractedText(data.text));
            totalConfidence += data.confidence || 0;
            recognizedPages++;
          }
        } catch (err) {
          logger.warn(`OCR failed for PDF page ${pageNum}:`, err);
        } finally {
          page.cleanup();
        }
      }

      await doc.destroy();

      const text = pageTexts.join('\n\n');
      logger.info(`OCR'd scanned PDF (${numPages} pages, ${recognizedPages} with text).`);
      return {
        text,
        confidence: recognizedPages ? Math.round(totalConfidence / recognizedPages) : undefined,
        method: 'ocr',
      };
    } catch (err) {
      logger.error('Scanned PDF OCR failed:', err);
      return { text: '', method: 'ocr' };
    }
  }

  private async ensureOcrWorker() {
    if (!this.ocrWorker) {
      await this.initOCRWorker();
    }
    return this.ocrWorker!;
  }

  async extractFromImage(filePath: string): Promise<ExtractionResult> {
    try {
      const py = await this.ocrViaPython(filePath);
      if (py) {
        return {
          text: py.text,
          confidence: py.confidence || 0,
          method: 'ocr',
        };
      }

      if (!this.ocrWorker) {
        await this.initOCRWorker();
      }

      const { data } = await this.ocrWorker!.recognize(filePath);
      const rawText = (data.text || '').trim();

      return {
        text: cleanExtractedText(rawText),
        confidence: data.confidence || 0,
        method: 'ocr',
      };
    } catch (err) {
      logger.error(`OCR extraction failed for ${filePath}:`, err);
      throw new Error(`Failed to extract text from image: ${err}`);
    }
  }

  private async initOCRWorker(): Promise<void> {
    const language = config.email.label === 'circulars' ? config.env === 'production' ? 'eng' : 'eng' : 'eng';
    this.ocrWorker = await createWorker(language);

    if (config.env === 'development') {
      logger.debug('OCR worker initialized');
    }
  }

  async shutdown(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}

export const textExtractor = new TextExtractor();
export default textExtractor;
