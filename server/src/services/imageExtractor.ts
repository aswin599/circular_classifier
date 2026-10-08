import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadPdfjs, NapiCanvasFactory } from './textExtractor';
import { logger } from '../utils/logger';

export type ImageSourceType = 'pdf_page' | 'pdf_embed' | 'docx' | 'email_inline';

/**
 * An image extracted from some source, still held fully in memory.
 * `buffer` is always the raw encoded bytes (PNG/JPEG/GIF/BMP...).
 */
export interface ExtractedImage {
  sourceType: ImageSourceType;
  sourceAttachmentId?: string;
  page?: number;
  index?: number;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  buffer: Buffer;
}

/** An extracted image that has been written to disk, thumb-nailed and DB-ready. */
export interface PersistedImage {
  sourceAttachmentId?: string;
  sourceType: ImageSourceType;
  page?: number;
  index?: number;
  filename: string;
  mimeType: string;
  filePath: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  thumb: {
    filePath?: string;
    data?: Buffer;
    width: number;
    height: number;
  };
}

export interface ImageSourceAttachment {
  filename?: string;
  fileType?: string;
  contentType?: string;
  contentId?: string;
  data?: Buffer;
  filePath?: string;
  sourceAttachmentId?: string;
}

const PAGE_SCALE = 2;
const THUMB_MAX_WIDTH = 360;
const THUMB_MAX_HEIGHT = 360;
const MAX_PDF_PAGES = 50;

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff', 'webp'];

/**
 * Sniff the real image MIME type from magic bytes instead of trusting the
 * file extension, which is what makes extraction "accurate" when emails and
 * PDFs report misleading names or `application/octet-stream`.
 */
export function sniffImageMime(buffer: Buffer, fallback?: string): string {
  if (!buffer || buffer.length < 4) return fallback || 'application/octet-stream';
  const hex = buffer.slice(0, 4).toString('hex').toUpperCase();

  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('89504E47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('424D')) return 'image/bmp';
  if (
    hex === '49492A00' ||
    hex === '4D4D002A' ||
    hex.startsWith('49492B00') ||
    hex.startsWith('4D4D002B')
  ) {
    return 'image/tiff';
  }
  if (hex.startsWith('52494646')) {
    // RIFF....WEBP
    if (buffer.length > 12 && buffer.toString('latin1', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    return 'image/webp';
  }

  return fallback || 'application/octet-stream';
}

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tif',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'img';
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function isImageExtension(fileType?: string): boolean {
  const ext = (fileType || '').toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | undefined> {
  try {
    const image = await loadImage(buffer);
    const width = typeof image.width === 'number' ? image.width : 0;
    const height = typeof image.height === 'number' ? image.height : 0;
    if (width > 0 && height > 0) return { width, height };
  } catch {
    // not a decodable raster image (e.g. corrupt or SVG/WMF)
  }
  return undefined;
}

/**
 * Create a small JPEG thumbnail (max ~360px) from any raster buffer.
 * Runs on the threadpool via @napi-rs/canvas (no external sharp dependency).
 */
export async function makeThumbnail(
  buffer: Buffer,
  opts: { maxWidth?: number; maxHeight?: number } = {}
): Promise<{ buffer: Buffer; width: number; height: number } | undefined> {
  try {
    const maxWidth = opts.maxWidth || THUMB_MAX_WIDTH;
    const maxHeight = opts.maxHeight || THUMB_MAX_HEIGHT;
    const img = await loadImage(buffer);
    if (!img.width || !img.height) return undefined;

    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img as any, 0, 0, width, height);
    const thumbBuffer = canvas.toBuffer('image/jpeg', 80);

    return { buffer: thumbBuffer, width, height };
  } catch (err) {
    logger.warn('Thumbnail generation failed:', err);
    return undefined;
  }
}

/**
 * Render every page of a PDF buffer to PNG via pdf.js + @napi-rs/canvas.
 * This is the most accurate representation of a circular document, and also
 * covers scanned PDFs where no text layer exists.
 */
export async function renderPdfPagesToImages(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  const pdfjs = loadPdfjs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    canvasFactory: new NapiCanvasFactory(),
    disableFontFace: true,
  });

  const doc = await loadingTask.promise;
  const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(PAGE_SCALE, 3500 / Math.max(base.width, base.height, 1));
        const viewport = page.getViewport({ scale });
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
        images.push({
          sourceType: 'pdf_page',
          page: pageNum,
          index: pageNum,
          filename: `page-${pageNum}.png`,
          mimeType: 'image/png',
          width,
          height,
          buffer: pngBuffer,
        });
      } catch (err) {
        logger.warn(`Failed to render PDF page ${pageNum}:`, err);
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  logger.info(`Rendered ${images.length} page images from PDF`);
  return images;
}

/**
 * Extract embedded raster images (figures, logos, stamps, signatures) from a
 * PDF by walking the operator list for `paintImageXObject`. JPEG streams pass
 * through losslessly; other decodable streams are rasterized to PNG. Anything
 * we cannot rebuild cleanly is skipped (the full page render still covers it).
 */
export async function extractEmbeddedPdfImages(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  const pdfjs = loadPdfjs();
  const OPS = pdfjs.OPS;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    canvasFactory: new NapiCanvasFactory(),
  });
  const doc = await loadingTask.promise;
  const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      try {
        let opList: { fnArray: number[]; argsArray: unknown[][] };
        try {
          opList = await page.getOperatorList();
        } catch (err) {
          logger.warn(`Failed to get operator list for PDF page ${pageNum}:`, err);
          continue;
        }

        const fnArray = opList.fnArray || [];
        const argsArray = opList.argsArray || [];
        let embedIndex = 0;

        for (let i = 0; i < fnArray.length; i++) {
          if (fnArray[i] !== OPS.paintImageXObject) continue;
          const objId = argsArray[i]?.[0] as string | undefined;
          if (!objId) continue;

          try {
            const img = await page.objs.get(objId);
            if (!img) continue;

            const rawData: Uint8Array | undefined = img.data;
            if (!rawData || rawData.length === 0) continue;

            const width = img.width as number | undefined;
            const height = img.height as number | undefined;
            const filter = (img.filter as string | undefined) || '';
            embedIndex++;

            // JPEG streams stay untouched -> original quality, truly lossless.
            if (
              filter === 'DCTDecode' ||
              (rawData.length > 2 && rawData[0] === 0xff && rawData[1] === 0xd8)
            ) {
              const jpeg = Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength);
              images.push({
                sourceType: 'pdf_embed',
                page: pageNum,
                index: embedIndex,
                filename: `embed-${pageNum}-${embedIndex}.jpg`,
                mimeType: 'image/jpeg',
                width,
                height,
                buffer: jpeg,
              });
              continue;
            }

            if (!width || !height) continue;

            // Decoded pixel streams: rebuild RGBA from known layout and encode PNG.
            const perPixel = rawData.length / (width * height);
            const rgba = Buffer.alloc(width * height * 4);

            if (perPixel === 3) {
              for (let p = 0, q = 0; p < width * height; p++, q += 3) {
                rgba[p * 4] = rawData[q];
                rgba[p * 4 + 1] = rawData[q + 1];
                rgba[p * 4 + 2] = rawData[q + 2];
                rgba[p * 4 + 3] = 255;
              }
            } else if (perPixel === 4) {
              Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).copy(rgba);
            } else if (perPixel === 1) {
              for (let p = 0; p < width * height; p++) {
                const v = rawData[p];
                rgba[p * 4] = v;
                rgba[p * 4 + 1] = v;
                rgba[p * 4 + 2] = v;
                rgba[p * 4 + 3] = 255;
              }
            } else {
              continue;
            }

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(width, height);
            imageData.data.set(rgba as unknown as Uint8ClampedArray);
            ctx.putImageData(imageData, 0, 0);
            const pngBuffer = canvas.toBuffer('image/png');

            images.push({
              sourceType: 'pdf_embed',
              page: pageNum,
              index: embedIndex,
              filename: `embed-${pageNum}-${embedIndex}.png`,
              mimeType: 'image/png',
              width,
              height,
              buffer: pngBuffer,
            });
          } catch (err) {
            logger.debug(`Could not extract embedded PDF image ${objId} on page ${pageNum}:`, err);
          }
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  logger.info(`Extracted ${images.length} embedded images from PDF`);
  return images;
}

/** Extract every raster image referenced by a PDF (pages + embedded figures). */
export async function extractPdfImages(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  try {
    const [pages, embeds] = await Promise.allSettled([
      renderPdfPagesToImages(pdfBuffer),
      extractEmbeddedPdfImages(pdfBuffer),
    ]);

    const pageImgs = pages.status === 'fulfilled' ? pages.value : [];
    const embedImgs = embeds.status === 'fulfilled' ? embeds.value : [];

    if (pages.status === 'rejected') logger.warn('PDF page rendering failed:', pages.reason);
    if (embeds.status === 'rejected') logger.warn('PDF embedded image extraction failed:', embeds.reason);

    // Page renders are always the authoritative view; keep them first.
    return [...pageImgs, ...embedImgs];
  } catch (err) {
    logger.error('PDF image extraction failed:', err);
    return [];
  }
}

/**
 * Extract images stored under `word/media/` inside a DOCX (stamps, embedded
 * figures, letter-heads). Uses jszip (already in the dependency tree).
 */
export async function extractDocxImages(docxBuffer: Buffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    const mediaFiles = Object.keys(zip.files)
      .filter((name) => /^word\/media\//i.test(name) && !zip.files[name].dir)
      .sort();

    let index = 0;
    for (const name of mediaFiles) {
      const ext = path.extname(name).replace('.', '').toLowerCase();
      if (!isImageExtension(ext)) continue;
      if (ext === 'wmf' || ext === 'emf') continue;

      index++;
      const data = await zip.files[name].async('nodebuffer');
      if (!data || data.length === 0) continue;

      const mimeType = sniffImageMime(data, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      const dims = await getImageDimensions(data);
      images.push({
        sourceType: 'docx',
        index,
        filename: path.basename(name),
        mimeType,
        width: dims?.width,
        height: dims?.height,
        buffer: data,
      });
    }
  } catch (err) {
    logger.error('DOCX image extraction failed:', err);
  }

  logger.info(`Extracted ${images.length} images from DOCX`);
  return images;
}

/**
 * Collect images carried in the email itself. Every image-typed part is kept;
 * parts that carry a `contentId` are inline images referenced from the HTML
 * body (logos, headers, embedded pictures). Attachment buffers pass straight
 * through, so nothing is re-encoded and quality is preserved.
 */
export async function extractEmailImageAttachments(
  attachments: ImageSourceAttachment[]
): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];

  for (const att of attachments || []) {
    const fileType = (att.fileType || '').toLowerCase();
    const isImage =
      isImageExtension(fileType) ||
      ((att.contentType || '').toLowerCase().startsWith('image/') && !fileType);

    if (!isImage) continue;

    let buffer: Buffer | undefined;
    if (att.data && att.data.length > 0) {
      buffer = att.data;
    } else if (att.filePath && fs.existsSync(att.filePath)) {
      try {
        buffer = fs.readFileSync(att.filePath);
      } catch {
        buffer = undefined;
      }
    }
    if (!buffer) continue;

    const mimeType = sniffImageMime(buffer, `image/${fileType === 'jpg' ? 'jpeg' : fileType}`);
    const dims = await getImageDimensions(buffer);
    const base = safeName((att.filename || 'inline').replace(path.extname(att.filename || ''), ''));

    images.push({
      sourceType: 'email_inline',
      index: images.length + 1,
      filename: `${base}.${extensionFromMime(mimeType)}`,
      mimeType,
      width: dims?.width,
      height: dims?.height,
      buffer,
    });
  }

  return images;
}

/** Low-level: produce every raster image for one attachment by type. */
export async function extractAttachmentImages(
  att: { data?: Buffer; filePath?: string; fileType?: string; filename?: string; sourceAttachmentId?: string }
): Promise<ExtractedImage[]> {
  const fileType = (att.fileType || '').toLowerCase();
  if (fileType === 'pdf') {
    const pdfBuffer = att.data && att.data.length > 0 ? att.data : att.filePath && fs.existsSync(att.filePath) ? fs.readFileSync(att.filePath) : null;
    if (!pdfBuffer) return [];
    return (await extractPdfImages(pdfBuffer)).map((im) => ({ ...im, sourceAttachmentId: att.sourceAttachmentId }));
  }
  if (fileType === 'docx') {
    const docxBuffer = att.data && att.data.length > 0 ? att.data : att.filePath && fs.existsSync(att.filePath) ? fs.readFileSync(att.filePath) : null;
    if (!docxBuffer) return [];
    return (await extractDocxImages(docxBuffer)).map((im) => ({ ...im, sourceAttachmentId: att.sourceAttachmentId }));
  }
  if (isImageExtension(fileType)) {
    const buffer = att.data && att.data.length > 0 ? att.data : att.filePath && fs.existsSync(att.filePath) ? fs.readFileSync(att.filePath) : null;
    if (!buffer) return [];
    const mimeType = sniffImageMime(buffer, `image/${fileType === 'jpg' ? 'jpeg' : fileType}`);
    const dims = await getImageDimensions(buffer);
    const base = safeName((att.filename || 'attachment').replace(path.extname(att.filename || ''), ''));
    return [
      {
        sourceType: 'email_inline',
        sourceAttachmentId: att.sourceAttachmentId,
        index: 1,
        filename: `${base}.${extensionFromMime(mimeType)}`,
        mimeType,
        width: dims?.width,
        height: dims?.height,
        buffer,
      },
    ];
  }

  // Unknown -> sniff the bytes; a PDF can be mislabeled as application/octet-stream.
  const buffer = att.data && att.data.length > 0 ? att.data : att.filePath && fs.existsSync(att.filePath) ? fs.readFileSync(att.filePath) : null;
  if (buffer && buffer.length >= 5 && buffer.toString('latin1', 0, 5) === '%PDF-') {
    return (await extractPdfImages(buffer)).map((im) => ({ ...im, sourceAttachmentId: att.sourceAttachmentId }));
  }

  if (buffer) {
    const mimeType = sniffImageMime(buffer);
    if (mimeType && mimeType !== 'application/octet-stream') {
      const dims = await getImageDimensions(buffer);
      const base = safeName((att.filename || 'attachment').replace(path.extname(att.filename || ''), ''));
      return [
        {
          sourceType: 'email_inline',
          sourceAttachmentId: att.sourceAttachmentId,
          index: 1,
          filename: `${base}.${extensionFromMime(mimeType)}`,
          mimeType,
          width: dims?.width,
          height: dims?.height,
          buffer,
        },
      ];
    }
  }

  return [];
}

/**
 * Write extracted images (+ per-image thumbnail) to disk and return the
 * DB-ready `PersistedImage` records with dimensions and paths resolved.
 */
export async function persistExtractedImages(
  images: ExtractedImage[],
  destDir: string,
  baseName: string,
  sourceAttachmentId?: string
): Promise<PersistedImage[]> {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const persisted: PersistedImage[] = [];
  const slug = safeName(baseName) || 'image';

  let primaryAssigned = false;
  for (const image of images) {
    if (!image.buffer || image.buffer.length === 0) continue;

    const prefix = `${slug}-${image.sourceType}${image.page ? `-p${image.page}` : ''}${image.index ? `-${image.index}` : ''}`;
    const filePath = path.join(destDir, `${prefix}.${extensionFromMime(image.mimeType)}`);

    try {
      fs.writeFileSync(filePath, image.buffer);
    } catch (err) {
      logger.warn(`Failed to persist extracted image ${filePath}:`, err);
      continue;
    }

    const thumb = await makeThumbnail(image.buffer);

    const record: PersistedImage = {
      sourceAttachmentId: image.sourceAttachmentId || sourceAttachmentId,
      sourceType: image.sourceType,
      page: image.page,
      index: image.index,
      filename: `${prefix}.${extensionFromMime(image.mimeType)}`,
      mimeType: image.mimeType,
      filePath,
      width: image.width,
      height: image.height,
      isPrimary: !primaryAssigned,
      thumb: {
        width: 0,
        height: 0,
      },
    };

    if (thumb && thumb.buffer) {
      if (!primaryAssigned) {
        // Keep the primary thumbnail in memory so cards can render instantly.
        record.thumb.data = thumb.buffer;
        record.thumb.width = thumb.width;
        record.thumb.height = thumb.height;
      } else {
        const thumbPath = path.join(destDir, `${prefix}.thumb.jpg`);
        try {
          fs.writeFileSync(thumbPath, thumb.buffer);
          record.thumb.filePath = thumbPath;
          record.thumb.width = thumb.width;
          record.thumb.height = thumb.height;
        } catch {
          record.thumb.data = thumb.buffer;
          record.thumb.width = thumb.width;
          record.thumb.height = thumb.height;
        }
      }
    }

    if (!primaryAssigned) primaryAssigned = true;
    persisted.push(record);
  }

  return persisted;
}

/**
 * Gather and persist every image for an email: all attachment-derived images
 * (PDF pages, embedded PDF figures, DOCX media) plus inline email images.
 * Returns the DB-ready records and the primary thumbnail buffer (if any).
 */
export async function buildImagesForEmail(
  attachments: ImageSourceAttachment[],
  destDir: string,
  baseName: string
): Promise<{ images: PersistedImage[]; primaryThumb?: Buffer }> {
  const extracted: ExtractedImage[] = [];

  for (const att of attachments || []) {
    try {
      const perAtt = await extractAttachmentImages(att);
      extracted.push(...perAtt);
    } catch (err) {
      logger.warn(`Image extraction failed for ${att.filename || 'attachment'}:`, err);
    }
  }

  try {
    const inline = await extractEmailImageAttachments(attachments);
    // Avoid double-extracting images that were already pull as attachments.
    const dupKeys = new Set<string>();
    for (const im of extracted) dupKeys.add(im.buffer.toString('base64'));
    for (const im of inline) {
      if (!dupKeys.has(im.buffer.toString('base64'))) extracted.push(im);
    }
  } catch (err) {
    logger.warn('Inline image extraction failed:', err);
  }

  // De-duplicate identical buffers (e.g. the same logo embedded twice).
  const seen = new Set<string>();
  const unique: ExtractedImage[] = [];
  for (const im of extracted) {
    const key = im.buffer.toString('base64');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(im);
  }

  const persisted = await persistExtractedImages(unique, destDir, baseName);
  const primary = persisted.find((p) => p.isPrimary && p.thumb && p.thumb.data);

  return {
    images: persisted,
    primaryThumb: primary?.thumb?.data,
  };
}

/**
 * Single-attachment variant used by the extraction queue: extract + persist
 * images for one attachment and return the records (primary thumb included).
 */
export async function extractAndPersistAttachmentImages(
  att: ImageSourceAttachment,
  destDir: string,
  baseName: string,
  sourceAttachmentId?: string
): Promise<{ images: PersistedImage[]; primaryThumb?: Buffer }> {
  const extracted = await extractAttachmentImages(att);
  const persisted = await persistExtractedImages(extracted, destDir, baseName, sourceAttachmentId);
  const primary = persisted.find((p) => p.isPrimary && p.thumb && p.thumb.data);
  return { images: persisted, primaryThumb: primary?.thumb?.data };
}

export const imageExtractor = {
  sniffImageMime,
  makeThumbnail,
  renderPdfPagesToImages,
  extractEmbeddedPdfImages,
  extractPdfImages,
  extractDocxImages,
  extractEmailImageAttachments,
  extractAttachmentImages,
  persistExtractedImages,
  buildImagesForEmail,
  extractAndPersistAttachmentImages,
};

export default imageExtractor;