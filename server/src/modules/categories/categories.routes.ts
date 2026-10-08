import { Router } from 'express';
import { Category } from '../../models/Category';
import { Circular } from '../../models/Circular';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

function serializeCategory(category: Record<string, any>) {
  return {
    id: category._id?.toString(),
    name: category.name,
    description: category.description,
    keywords: category.keywords,
    color: category.color,
    createdAt: category.createdAt,
    _count: category.circularCount !== undefined ? { circulars: category.circularCount } : undefined,
  };
}

router.get('/', authenticate, async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });

  const result = [];
  for (const category of categories) {
    const circularCount = await Circular.countDocuments({
      categoryId: category._id,
    });

    const obj = category.toObject();
    result.push({
      ...obj,
      id: obj._id?.toString(),
      _id: undefined,
      __v: undefined,
      _count: { circulars: circularCount },
    });
  }

  res.json({ data: result });
});

router.get('/:id', authenticate, async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const recentCirculars = await Circular.find({ categoryId: category._id })
    .sort({ receivedDate: -1 })
    .select('subject receivedDate priority')
    .limit(10);

  const obj = category.toObject();
  res.json({
    category: {
      ...obj,
      id: obj._id?.toString(),
      circulars: recentCirculars.map((c) => ({
        id: c._id.toString(),
        subject: c.subject,
        receivedDate: c.receivedDate,
        priority: c.priority,
      })),
    },
  });
});

// Admin-only operations below
router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/', async (req, res) => {
  const { name, description, keywords, color } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const exists = await Category.findOne({ name });
  if (exists) {
    res.status(409).json({ error: 'Category name already exists' });
    return;
  }

  const category = await Category.create({
    name,
    description: description ?? undefined,
    keywords: Array.isArray(keywords) ? keywords : [],
    color: color ?? '#3B82F6',
  });

  const obj = category.toObject();
  res.status(201).json({ category: serializeCategory(obj) });
});

router.put('/:id', async (req, res) => {
  const { name, description, keywords, color } = req.body;

  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (description !== undefined) update.description = description;
  if (keywords) update.keywords = keywords;
  if (color) update.color = color;

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true }
  );

  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const obj = category.toObject();
  res.json({ category: serializeCategory(obj) });
});

router.delete('/:id', async (req, res) => {
  const count = await Circular.countDocuments({ categoryId: req.params.id });
  if (count > 0) {
    res.status(400).json({
      error: `Cannot delete category with ${count} associated circulars. Reassign or delete them first.`,
    });
    return;
  }

  await Category.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
