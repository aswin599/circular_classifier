import { Router } from 'express';
import { User } from '../../models/User';
import { Circular } from '../../models/Circular';
import { Category } from '../../models/Category';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

router.get('/overview', authenticate, async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalCirculars, circularsThisWeek, unprocessed, totalAttachments, categories, priorityAgg] =
    await Promise.all([
      Circular.countDocuments(),
      Circular.countDocuments({ receivedDate: { $gte: weekAgo } }),
      Circular.countDocuments({ isProcessed: false }),
      Circular.aggregate([
        { $unwind: '$attachments' },
        { $count: 'count' },
      ]),
      Category.find().select('name'),
      Circular.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

  const categoryCounts = await Circular.aggregate([
    { $match: { categoryId: { $ne: null } } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);

  const categoryMap: Record<string, number> = {};
  for (const item of categoryCounts) {
    const cat = categories.find((c) => c._id.toString() === item._id.toString());
    categoryMap[cat?.name || 'Uncategorized'] = item.count;
  }

  const priorityMap: Record<string, number> = {};
  for (const item of priorityAgg) {
    priorityMap[item._id] = item.count;
  }

  res.json({
    totalCirculars,
    circularsThisWeek,
    unprocessedCount: unprocessed,
    totalAttachments: totalAttachments[0]?.count || 0,
    totalByCategory: categoryMap,
    totalByPriority: priorityMap,
  });
});

router.get(
  '/recent',
  authenticate,
  authorize('ADMIN'),
  async (_req, res) => {
    const [recentCirculars, recentUsers] = await Promise.all([
      Circular.find()
        .sort({ receivedDate: -1 })
        .limit(5)
        .select('subject receivedDate priority'),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fullName email role createdAt'),
    ]);

    res.json({
      recentCirculars: recentCirculars.map((c) => ({
        id: c._id.toString(),
        subject: c.subject,
        receivedDate: c.receivedDate,
        priority: c.priority,
      })),
      recentUsers: recentUsers.map((u) => ({
        id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  }
);

export default router;
