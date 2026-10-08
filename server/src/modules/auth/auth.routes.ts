import { Router } from 'express';
import { z } from 'zod';
import { User } from '../../models/User';
import { hashPassword, issueAccessToken, issueRefreshToken, verifyPassword, verifyRefreshToken } from '../../utils/jwt';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    fullName: z.string().min(2, 'Full name is required'),
    department: z.string().optional(),
    role: z.enum(['ADMIN', 'STUDENT']).default('STUDENT'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

router.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req);
  if (!result.success) {
    res.status(400).json({ error: 'validation error', details: result.error.errors });
    return;
  }

  const { email, password, fullName, department, role } = result.data.body;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const assignedRole = email.toLowerCase() === 'circularclassifier@gmail.com' ? 'ADMIN' : 'STUDENT';

  const user = await User.create({
    email,
    passwordHash,
    fullName,
    department: department ?? undefined,
    role: assignedRole,
  });

  const accessToken = issueAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
  const refreshToken = issueRefreshToken({ id: user._id.toString() });

  await User.findByIdAndUpdate(user._id, { refreshToken });

  res.status(201).json({
    accessToken,
    refreshToken,
    user: user.toJSON(),
  });
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req);
  if (!result.success) {
    res.status(400).json({ error: 'validation error', details: result.error.errors });
    return;
  }

  const { email, password } = result.data.body;

  const user = await User.findOne({ email }).select('+passwordHash +refreshToken');
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Account is disabled' });
    return;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Enforce sole admin rule: only circularclassifier@gmail.com can be ADMIN
  const correctRole = user.email.toLowerCase() === 'circularclassifier@gmail.com' ? 'ADMIN' : 'STUDENT';
  if (user.role !== correctRole) {
    user.role = correctRole;
    await user.save();
  }

  const accessToken = issueAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
  const refreshToken = issueRefreshToken({ id: user._id.toString() });

  await User.findByIdAndUpdate(user._id, { refreshToken });

  res.json({
    accessToken,
    refreshToken,
    user: user.toJSON(),
  });
});

router.post('/refresh', async (req, res) => {
  const result = refreshSchema.safeParse(req);
  if (!result.success) {
    res.status(400).json({ error: 'validation error' });
    return;
  }

  try {
    const payload = verifyRefreshToken(result.data.body.refreshToken);

    const user = await User.findById(payload.id).select('+refreshToken');
    if (!user || user.refreshToken !== result.data.body.refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const accessToken = issueAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
    const newRefreshToken = issueRefreshToken({ id: user._id.toString() });

    await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Browser-extension helper: exchange a refresh token for a fresh access token
// WITHOUT rotating the refresh token. Rotation is skipped here so an already
// signed-in web session (which shares the same single refresh token) is never
// invalidated when the extension refreshes its own credentials.
router.post('/extension-token', async (req, res) => {
  const result = refreshSchema.safeParse(req);
  if (!result.success) {
    res.status(400).json({ error: 'validation error' });
    return;
  }

  try {
    const payload = verifyRefreshToken(result.data.body.refreshToken);

    const user = await User.findById(payload.id).select('+refreshToken');
    if (!user || !user.isActive || user.refreshToken !== result.data.body.refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const accessToken = issueAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: user.toJSON() });
});

router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  await User.findByIdAndUpdate(req.user!.id, { refreshToken: null });
  res.json({ success: true });
});

export default router;
