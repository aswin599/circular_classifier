import { Router } from 'express';
import { User } from '../../models/User';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ data: users.map((u) => u.toJSON()) });
});

router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: user.toJSON() });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
