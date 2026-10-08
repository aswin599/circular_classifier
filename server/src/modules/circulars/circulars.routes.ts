import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { Circular, CircularImageSubdoc } from '../../models/Circular';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { extractAndPersistAttachmentImages } from '../../services/imageExtractor';
import { CircularRead } from '../../models/CircularRead';
import { applyAudienceFilter, applyUnreadFilter, getReadCircularIds } from '../../services/circularAccess';
import { extractSenderNameFromRef, formatRefSenderName } from '../../utils/senderName';

const router = Router();

function imageToJSON(image: any, circularId?: string) {
  const result: Record<string, unknown> = {
    id: image._id?.toString?.() || image.id,
    sourceAttachmentId: image.sourceAttachmentId
      ? image.sourceAttachmentId.toString?.() || image.sourceAttachmentId
      : undefined,
    sourceType: image.sourceType,
    page: image.page,
    index: image.index,
    filename: image.filename,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    isPrimary: !!image.isPrimary,
    thumb: image.thumb
      ? {
          width: image.thumb.width || 0,
          height: image.thumb.height || 0,
        }
      : undefined,
  };
  if (circularId) {
    result.viewPath = `/api/circulars/${circularId}/images/${result.id}`;
    result.thumbPath = `/api/circulars/${circularId}/images/${result.id}/thumb`;
  }
  return result;
}

function serializeCircular(doc: any) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };

  const cat = (obj.category && obj.category.name)
    ? obj.category
    : (obj.categoryId && typeof obj.categoryId === 'object' && obj.categoryId.name)
    ? obj.categoryId
    : null;

  // Populate category ref if present
  const result: Record<string, unknown> = {
    id: obj._id?.toString(),
    subject: obj.subject,
    shortTitle: obj.shortTitle,
    summaryBullets: obj.summaryBullets || [],
    senderEmail: obj.senderEmail,
    senderName: obj.senderName,
    receivedDate: obj.receivedDate,
    bodyText: obj.bodyText,
    extractedText: obj.extractedText,
    categoryId: (cat ? cat._id || cat.id : obj.categoryId)?.toString(),
    category: cat
      ? {
          id: (cat._id || cat.id)?.toString(),
          name: cat.name,
          color: cat.color || '#8B5CF6',
          description: cat.description,
        }
      : undefined,
    priority: obj.priority,
    priorityOrder: obj.priorityOrder || 2,
    tags: obj.tags || [],
    processingStatus: obj.processingStatus,
    isProcessed: obj.isProcessed,
    isDuplicate: !!obj.isDuplicate,
    duplicateOfDate: obj.duplicateOfDate,
    targetRole: obj.targetRole || 'ALL',
    expireDate: obj.expireDate,
    expirySource: obj.expirySource,
    expiryConfidence: obj.expiryConfidence,
    emailMessageId: obj.emailMessageId,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    createdBy: obj.createdBy || { role: 'SYSTEM' },
    attachments: (obj.attachments || []).map((att: any) => ({
      id: att._id?.toString(),
      filename: att.filename,
      fileType: att.fileType,
      fileSize: att.fileSize,
      filePath: att.filePath,
      extractedText: att.extractedText,
      ocrConfidence: att.ocrConfidence,
      isProcessed: att.isProcessed,
    })),
    images: (obj.images || []).map((image: any) => imageToJSON(image, obj._id?.toString())),
    primaryThumbnail: obj.primaryThumb && obj.primaryThumb.length
      ? `data:image/jpeg;base64,${obj.primaryThumb.toString('base64')}`
      : undefined,
  };

  return result;
}

router.use(authenticate);

// Quick count of circulars ending today for the left sidebar navigation badge
router.get('/ending-today-count', async (req: AuthRequest, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const filter: Record<string, any> = {
    expireDate: { $gte: startOfToday, $lte: endOfToday },
  };
  applyAudienceFilter(filter, req.user?.role);
  applyUnreadFilter(filter, await getReadCircularIds(req.user?.id));

  const count = await Circular.countDocuments(filter);

  res.json({ count });
});

// Priority breakdown for a recent window (defaults to the last 3 days).
// Used by the browser extension popup. HIGH/URGENT are grouped as "high"
// to match how the UI renders priority badges.
router.get('/priority-summary', async (req: AuthRequest, res) => {
  const parsedDays = parseInt(String(req.query.days ?? '3'), 10);
  const days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.min(parsedDays, 90) : 3;

  let startDate: Date;
  if (req.query.startDate) {
    startDate = new Date(String(req.query.startDate));
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
  }

  if (Number.isNaN(startDate.getTime())) {
    res.status(400).json({ error: 'Invalid startDate' });
    return;
  }

  const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
  if (endDate && Number.isNaN(endDate.getTime())) {
    res.status(400).json({ error: 'Invalid endDate' });
    return;
  }

  const filter: Record<string, any> = { receivedDate: { $gte: startDate } };
  if (endDate) filter.receivedDate.$lte = endDate;

  applyAudienceFilter(filter, req.user?.role);
  applyUnreadFilter(filter, await getReadCircularIds(req.user?.id));

  const grouped = await Circular.aggregate<{ _id: string; count: number }>([
    { $match: filter },
    { $group: { _id: '$priority', count: { $sum: 1 } } },
  ]);

  const counts = { high: 0, medium: 0, low: 0 };
  for (const row of grouped) {
    const priority = String(row._id || '').toUpperCase();
    if (priority === 'HIGH' || priority === 'URGENT') counts.high += row.count;
    else if (priority === 'LOW') counts.low += row.count;
    else counts.medium += row.count;
  }

  res.json({
    days,
    startDate,
    endDate: endDate ?? null,
    total: counts.high + counts.medium + counts.low,
    counts,
  });
});

router.get('/', async (req: AuthRequest, res) => {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 100);

  const filter: Record<string, any> = {};

  // Students only see circulars sent from the tutor mailbox.
  applyAudienceFilter(filter, req.user?.role);
  applyUnreadFilter(filter, await getReadCircularIds(req.user?.id));

  if (req.query.categoryId) {
    filter.categoryId = new Types.ObjectId(String(req.query.categoryId));
  }
  if (req.query.priority) {
    filter.priority = String(req.query.priority).toUpperCase();
  }
  if (req.query.status) {
    filter.processingStatus = String(req.query.status).toUpperCase();
  }
  if (req.query.startDate || req.query.endDate) {
    filter.receivedDate = {};
    if (req.query.startDate) filter.receivedDate.$gte = new Date(String(req.query.startDate));
    if (req.query.endDate) filter.receivedDate.$lte = new Date(String(req.query.endDate));
  }
  if (req.query.tag) {
    filter.tags = String(req.query.tag);
  }

  // Ending today filter
  if (req.query.endingToday === 'true') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    filter.expireDate = { $gte: startOfToday, $lte: endOfToday };
  }

  // Filter by sender name (character-by-character regex matching)
  if (req.query.senderName) {
    const escaped = String(req.query.senderName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) {
      filter.$or = [
        { senderName: { $regex: escaped, $options: 'i' } },
        { senderEmail: { $regex: escaped, $options: 'i' } },
      ];
    }
  }

  // Real-time character-by-character keyword search
  if (req.query.q) {
    const queryStr = String(req.query.q).trim();
    if (queryStr) {
      const regex = new RegExp(queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { subject: regex },
        { shortTitle: regex },
        { senderName: regex },
        { senderEmail: regex },
        { bodyText: regex },
        { extractedText: regex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }
  }

  const skip = (page - 1) * limit;

  // Sorted based on priority and date
  const [circulars, total] = await Promise.all([
    Circular.find(filter)
      .populate('category')
      .sort({ priorityOrder: -1, receivedDate: -1 })
      .skip(skip)
      .limit(limit),
    Circular.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    data: circulars.map((c) => serializeCircular(c)),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

router.get('/:id', async (req: AuthRequest, res) => {
  const circular = await Circular.findById(req.params.id).populate('category');
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  // Students may only open circulars sent from the tutor mailbox.
  if (req.user?.role === 'STUDENT' && circular.senderEmail !== config.student.tutorEmail) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  res.json({ circular: serializeCircular(circular) });
});

// Mark / unmark a circular as read for the current user. Read circulars are
// hidden from the student/admin inbox and excluded from summary counts.
router.post('/:id/read', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid circular id' });
    return;
  }

  const circular = await Circular.exists({ _id: id });
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const isRead = req.body?.read !== false;
  const userId = new Types.ObjectId(req.user!.id);
  const circularId = new Types.ObjectId(id);

  if (isRead) {
    await CircularRead.updateOne(
      { userId, circularId },
      { $set: { readAt: new Date() } },
      { upsert: true }
    );
  } else {
    await CircularRead.deleteOne({ userId, circularId });
  }

  res.json({ success: true, isRead });
});

router.get('/:id/download/:attachmentId', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const attachment = circular.attachments.find((a: any) => a._id?.toString() === req.params.attachmentId);
  if (!attachment) {
    res.status(404).json({ error: 'Attachment not found' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  // Stream from database in-memory buffer if available
  if (attachment.data) {
    res.send(attachment.data);
    return;
  }

  // Fallback to disk if legacy file exists
  if (attachment.filePath && fs.existsSync(attachment.filePath)) {
    res.sendFile(path.resolve(attachment.filePath));
    return;
  }

  throw new AppError(404, 'Attachment data not found');
});

router.get('/:id/view/:attachmentId', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const attachment = circular.attachments.find((a: any) => a._id?.toString() === req.params.attachmentId);
  if (!attachment) {
    res.status(404).json({ error: 'Attachment not found' });
    return;
  }

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    tiff: 'image/tiff',
  };

  const ext = path.extname(attachment.filename).slice(1).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', 'inline');

  // Stream from database in-memory buffer if available
  if (attachment.data) {
    res.send(attachment.data);
    return;
  }

  // Fallback to disk if legacy file exists
  if (attachment.filePath && fs.existsSync(attachment.filePath)) {
    res.sendFile(path.resolve(attachment.filePath));
    return;
  }

  throw new AppError(404, 'Attachment data not found');
});

function serveImageFile(res: any, buffer: Buffer | undefined, filePath: string | undefined, mimeType: string) {
  if (buffer && buffer.length > 0) {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
    return true;
  }
  if (filePath && fs.existsSync(filePath)) {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(filePath));
    return true;
  }
  return false;
}

// Full extracted image
router.get('/:id/images/:imageId', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const image = circular.images.find((img: any) => img._id?.toString() === req.params.imageId);
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const served = serveImageFile(res, undefined, image.filePath, image.mimeType || 'application/octet-stream');
  if (!served) throw new AppError(404, 'Image data not found');
});

// Thumbnail for an extracted image
router.get('/:id/images/:imageId/thumb', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const image = circular.images.find((img: any) => img._id?.toString() === req.params.imageId);
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const thumb = image.thumb || {};
  const served = serveImageFile(res, thumb.data, thumb.filePath, 'image/jpeg');
  // Fall back to the full image when no thumbnail was generated.
  if (!served) {
    const full = serveImageFile(res, undefined, image.filePath, image.mimeType || 'application/octet-stream');
    if (!full) throw new AppError(404, 'Image data not found');
  }
});

// Admin-only operations
router.use(authorize('ADMIN'));

router.post('/', async (req: AuthRequest, res) => {
  const { subject, senderEmail, senderName, bodyText, priority, categoryId, tags, receivedDate } = req.body;

  if (!subject || !senderEmail) {
    res.status(400).json({ error: 'Subject and sender email are required' });
    return;
  }

  const circular = await Circular.create({
    subject,
    senderEmail,
    senderName: formatRefSenderName(
      senderName ?? extractSenderNameFromRef([subject, bodyText].filter(Boolean).join('\n'))
    ),
    bodyText: bodyText ?? undefined,
    categoryId: categoryId ? new Types.ObjectId(categoryId) : undefined,
    priority: (priority ?? 'NORMAL').toUpperCase(),
    tags: Array.isArray(tags) ? tags : [],
    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
    processingStatus: 'COMPLETED',
    isProcessed: true,
    createdBy: {
      userId: req.user!.id,
      email: req.user!.email,
      role: req.user!.role as 'ADMIN',
    },
  });

  const populated = await circular.populate('category');
  res.status(201).json({ circular: serializeCircular(populated) });
});

router.put('/:id', async (req, res) => {
  const { subject, senderName, categoryId, priority, tags, bodyText, processingStatus } = req.body;

  const update: Record<string, unknown> = {};
  if (subject) update.subject = subject;
  if (senderName !== undefined) update.senderName = formatRefSenderName(senderName);
  if (categoryId !== undefined) update.categoryId = categoryId ? new Types.ObjectId(categoryId) : null;
  if (priority) update.priority = priority.toUpperCase();
  if (tags) update.tags = tags;
  if (bodyText !== undefined) update.bodyText = bodyText;
  if (processingStatus) update.processingStatus = processingStatus.toUpperCase();

  const circular = await Circular.findByIdAndUpdate(req.params.id, update, {
    new: true,
  }).populate('category');

  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  res.json({ circular: serializeCircular(circular) });
});

router.delete('/:id', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  // Delete files from disk
  for (const attachment of circular.attachments) {
    const filePath = path.resolve(attachment.filePath);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Log and continue
      }
    }
  }

  await Circular.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

router.post('/:id/reprocess', async (req, res) => {
  const circular = await Circular.findByIdAndUpdate(
    req.params.id,
    { processingStatus: 'PENDING', isProcessed: false },
    { new: true }
  );

  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  res.json({ circular: serializeCircular(circular) });
});

// Re-run image extraction for a circular's existing attachments
router.post('/:id/extract-images', async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  const destDir = path.join(path.resolve(config.upload.dir), 'extracted');
  const baseName = circular._id.toString();
  let extracted = 0;

  for (const attachment of circular.attachments) {
    if (!attachment.filePath || !fs.existsSync(attachment.filePath)) continue;

    const { images, primaryThumb } = await extractAndPersistAttachmentImages(
      {
        filePath: attachment.filePath,
        fileType: attachment.fileType,
        sourceAttachmentId: attachment._id.toString(),
      },
      destDir,
      `${baseName}-${attachment._id.toString()}`,
      attachment._id.toString()
    );

    const existingKeys = new Set((circular.images || []).map((im: CircularImageSubdoc) => `${im.sourceType}-${im.page}-${im.index}`));
    const fresh = images.filter((im) => !existingKeys.has(`${im.sourceType}-${im.page}-${im.index}`));

    circular.images.push(...(fresh as any));
    if (!circular.primaryThumb && primaryThumb) {
      circular.primaryThumb = primaryThumb;
    }
    extracted += fresh.length;
  }

  await circular.save();
  const populated = await circular.populate('category');
  res.json({ extracted, circular: serializeCircular(populated) });
});

export default router;
