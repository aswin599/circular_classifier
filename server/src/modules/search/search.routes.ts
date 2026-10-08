import { Router } from 'express';
import { Types } from 'mongoose';
import { Circular } from '../../models/Circular';
import { Category } from '../../models/Category';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { applyAudienceFilter, applyUnreadFilter, getReadCircularIds } from '../../services/circularAccess';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const q = String(req.query.q ?? '').trim();
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const priority = req.query.priority ? String(req.query.priority).toUpperCase() : undefined;
  const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
  const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
  const tag = req.query.tag ? String(req.query.tag) : undefined;
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);

  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};

  // Students only see circulars sent from the tutor mailbox, and everyone's
  // already-read circulars are hidden.
  applyAudienceFilter(filter, req.user?.role);
  applyUnreadFilter(filter, await getReadCircularIds(req.user?.id));

  if (q) {
    // Regex matching allows character-by-character instant search
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { subject: regex },
      { shortTitle: regex },
      { senderName: regex },
      { senderEmail: regex },
      { bodyText: regex },
      { extractedText: regex },
    ];
  }

  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    filter.categoryId = new Types.ObjectId(categoryId);
  }
  if (priority) filter.priority = priority;
  if (tag) filter.tags = tag;

  if (startDate || endDate) {
    filter.receivedDate = {};
    if (startDate) filter.receivedDate.$gte = startDate;
    if (endDate) filter.receivedDate.$lte = endDate;
  }

  const [circulars, total] = await Promise.all([
    Circular.find(filter)
      .populate('category')
      .sort({ priorityOrder: -1, receivedDate: -1 })
      .skip(skip)
      .limit(limit),
    Circular.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  const serialize = (c: any) => {
    const obj = typeof c.toObject === 'function' ? c.toObject({ virtuals: true }) : { ...c };
    const cat = (obj.category && obj.category.name)
      ? obj.category
      : (obj.categoryId && typeof obj.categoryId === 'object' && obj.categoryId.name)
      ? obj.categoryId
      : null;

    return {
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
      attachments: (obj.attachments || []).map((att: any) => ({
        id: att._id?.toString(),
        filename: att.filename,
        fileType: att.fileType,
        fileSize: att.fileSize,
        isProcessed: att.isProcessed,
      })),
    };
  };

  res.json({
    data: circulars.map(serialize),
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

router.get('/suggestions', async (_req, res) => {
  const categories = await Category.find().select('name');
  const distinctTags = await Circular.distinct('tags');

  res.json({
    categories: categories.map((c) => ({ id: c._id.toString(), name: c.name })),
    tags: distinctTags.slice(0, 50),
    priorities: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
  });
});

export default router;
