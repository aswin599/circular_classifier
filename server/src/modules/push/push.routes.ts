import { Router } from 'express';
import { PushSubscription } from '../../models/PushSubscription';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { config } from '../../config';

const router = Router();

router.use(authenticate);

interface LegacySubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * POST /api/push/subscribe
 * Save a browser Web Push subscription for the authenticated user.
 */
router.post('/subscribe', async (req: AuthRequest, res) => {
  const { endpoint, keys, userAgent } = req.body as LegacySubscriptionBody;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Missing endpoint or keys' });
    return;
  }

  if (!/^https?:\/\//.test(endpoint)) {
    res.status(400).json({ error: 'Invalid endpoint' });
    return;
  }

  try {
    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.user!.id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: userAgent || req.headers['user-agent'],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, id: String(subscription._id) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to save subscription' });
  }
});

/**
 * DELETE /api/push/subscribe
 * Remove a browser Web Push subscription (unsubscribe).
 */
router.delete('/subscribe', async (req: AuthRequest, res) => {
  const endpoint = String(req.query.endpoint || req.body?.endpoint || '');
  if (!endpoint) {
    await PushSubscription.deleteMany({ userId: req.user!.id });
    res.json({ success: true, removed: 'all' });
    return;
  }

  const result = await PushSubscription.deleteOne({ endpoint, userId: req.user!.id });
  res.json({ success: true, removed: result.deletedCount });
});

/**
 * GET /api/push/vapid-public-key
 * Public VAPID key used by the browser to subscribe.
 */
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: config.push.publicKey || null });
});

/**
 * GET /api/push/subscriptions
 * List the current user's subscriptions (for debugging).
 */
router.get('/subscriptions', async (req: AuthRequest, res) => {
  const subs = await PushSubscription.find({ userId: req.user!.id })
    .select('endpoint userAgent createdAt')
    .lean();
  res.json({ data: subs });
});

export default router;
