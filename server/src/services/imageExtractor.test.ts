import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import {
  sniffImageMime,
  makeThumbnail,
  renderPdfPagesToImages,
  extractEmbeddedPdfImages,
  extractPdfImages,
  extractDocxImages,
  persistExtractedImages,
  buildImagesForEmail,
} from './imageExtractor';

async function makeSamplePng(fill: string = '#4f46e5'): Promise<Buffer> {
  const canvas = createCanvas(64, 40);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 64, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(10, 10, 20, 20);
  return canvas.toBuffer('image/png');
}

async function makeSampleJpeg(): Promise<Buffer> {
  const canvas = createCanvas(60, 40);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b3261e';
  ctx.fillRect(0, 0, 60, 40);
  return canvas.toBuffer('image/jpeg', 90);
}

async function makePdfWithEmbeddedImages(): Promise<{ png: Buffer; jpeg: Buffer; pdf: Buffer }> {
  const png = await makeSamplePng();
  const jpeg = await makeSampleJpeg();

  const doc = await PDFDocument.create();
  const page = doc.addPage([220, 140]);
  page.drawText('Test circular', { x: 10, y: 110, size: 14, color: rgb(0, 0, 0) });

  const pngImage = await doc.embedPng(png);
  page.drawImage(pngImage, { x: 10, y: 20, width: pngImage.width, height: pngImage.height });

  const jpegImage = await doc.embedJpg(jpeg);
  page.drawImage(jpegImage, { x: 100, y: 20, width: jpegImage.width, height: jpegImage.height });

  const pdf = await doc.save();
  return { png, jpeg, pdf: Buffer.from(pdf) };
}

async function makeDocxWithImage(png: Buffer): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('word/media/image1.png', png);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(buffer);
}

describe('imageExtractor', () => {
  describe('sniffImageMime', () => {
    it('detects PNG and JPEG by magic bytes', async () => {
      const png = await makeSamplePng();
      const jpeg = await makeSampleJpeg();
      expect(sniffImageMime(png)).toBe('image/png');
      expect(sniffImageMime(jpeg)).toBe('image/jpeg');
    });

    it('falls back to the provided default', () => {
      expect(sniffImageMime(Buffer.from('not an image'), 'image/bmp')).toBe('image/bmp');
      expect(sniffImageMime(Buffer.alloc(10))).toBe('application/octet-stream');
    });
  });

  describe('makeThumbnail', () => {
    it('downscales an image into a JPEG thumbnail', async () => {
      const png = await makeSamplePng();
      const thumb = await makeThumbnail(png, { maxWidth: 32, maxHeight: 32 });
      expect(thumb).toBeDefined();
      expect(thumb!.width).toBeLessThanOrEqual(32);
      expect(thumb!.height).toBeLessThanOrEqual(32);
      expect(sniffImageMime(thumb!.buffer)).toBe('image/jpeg');
    });
  });

  describe('PDF extraction', () => {
    it('renders every page to a PNG', async () => {
      const { pdf } = await makePdfWithEmbeddedImages();
      const pages = await renderPdfPagesToImages(pdf);
      expect(pages.length).toBe(1);
      expect(pages[0].sourceType).toBe('pdf_page');
      expect(pages[0].mimeType).toBe('image/png');
      expect(pages[0].buffer.length).toBeGreaterThan(100);
      expect(pages[0].width).toBeGreaterThan(0);
    });

    it('extracts embedded images as PNG with correct dimensions', async () => {
      const { pdf } = await makePdfWithEmbeddedImages();
      const embeds = await extractEmbeddedPdfImages(pdf);
      expect(embeds.length).toBeGreaterThanOrEqual(2);

      const pngImage = embeds.find((im) => im.width === 64 && im.height === 40);
      const jpegImage = embeds.find((im) => im.width === 60 && im.height === 40);

      // pdf.js 3.x decodes DCTDecode streams to RGBA, so extracted embeds are
      // re-encoded PNGs (pixel-accurate) rather than byte-identical copies.
      expect(pngImage).toBeDefined();
      expect(jpegImage).toBeDefined();
      expect(pngImage!.mimeType).toBe('image/png');
      expect(jpegImage!.mimeType).toBe('image/png');
      expect(pngImage!.buffer.length).toBeGreaterThan(100);
      expect(jpegImage!.buffer.length).toBeGreaterThan(100);
      expect(jpegImage!.sourceType).toBe('pdf_embed');
    });

    it('extracts decoded (non-JPEG) raster images as PNG', async () => {
      const { pdf } = await makePdfWithEmbeddedImages();
      const embeds = await extractEmbeddedPdfImages(pdf);
      const pngImage = embeds.find((im) => im.mimeType === 'image/png');

      // pdf-lib stores PNGs with FlateDecode -> they come back rasterized via canvas.
      if (pngImage) {
        expect(pngImage.buffer.length).toBeGreaterThan(100);
        expect(pngImage.width).toBeGreaterThan(0);
        expect(pngImage.height).toBeGreaterThan(0);
      }
    });

    it('extractPdfImages returns page renders first', async () => {
      const { pdf } = await makePdfWithEmbeddedImages();
      const images = await extractPdfImages(pdf);
      expect(images.length).toBeGreaterThanOrEqual(2);
      expect(images[0].sourceType).toBe('pdf_page');
    });

    it('handles malformed PDF bytes gracefully', async () => {
      const images = await extractPdfImages(Buffer.from('this is definitely not a pdf'));
      expect(Array.isArray(images)).toBe(true);
    });
  });

  describe('DOCX extraction', () => {
    it('extracts images from word/media', async () => {
      const png = await makeSamplePng();
      const docx = await makeDocxWithImage(png);
      const images = await extractDocxImages(docx);
      expect(images.length).toBe(1);
      expect(images[0].sourceType).toBe('docx');
      expect(images[0].filename).toContain('image1');
      expect(images[0].mimeType).toBe('image/png');
    });

    it('returns an empty array for invalid DOCX bytes', async () => {
      const images = await extractDocxImages(Buffer.from('not a zip at all'));
      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBe(0);
    });
  });

  describe('persistExtractedImages', () => {
    it('writes images and thumbnails to disk with a primary flag', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-extract-'));
      const png = await makeSamplePng();
      await makePdfWithEmbeddedImages();

      const persisted = await persistExtractedImages(
        [
          { sourceType: 'email_inline', index: 1, filename: 'a.png', mimeType: 'image/png', buffer: png },
          { sourceType: 'pdf_page', page: 1, index: 1, filename: 'p1.png', mimeType: 'image/png', buffer: png, width: 220, height: 140 },
        ],
        dir,
        'testcircular'
      );

      expect(persisted.length).toBe(2);
      const primary = persisted.find((p) => p.isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.thumb.data).toBeDefined();
      expect(fs.existsSync(persisted[0].filePath)).toBe(true);
      expect(fs.existsSync(persisted[1].filePath)).toBe(true);
      expect(fs.existsSync(persisted[1].thumb.filePath!)).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('buildImagesForEmail', () => {
    it('extracts pages from a PDF attachment plus inline images', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-email-'));
      // Different content from the embedded image so content-dedupe keeps the attachment link.
      const inlinePng = await makeSamplePng('#16a34a');
      const { pdf } = await makePdfWithEmbeddedImages();

      const result = await buildImagesForEmail(
        [
          { filename: 'circular.pdf', fileType: 'pdf', data: pdf, sourceAttachmentId: 'abc123' },
          { filename: 'inline.png', fileType: 'png', data: inlinePng, sourceAttachmentId: 'def456' },
        ],
        dir,
        'mycircular'
      );

      expect(result.images.length).toBeGreaterThanOrEqual(3); // 1 page + 2 embeds + inline
      expect(result.primaryThumb).toBeDefined();
      expect(result.images.some((im) => im.sourceAttachmentId === 'def456')).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});