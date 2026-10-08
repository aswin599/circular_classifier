import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { realtime } from '../../services/realtime';

const router = Router();

/**
 * GET /api/stream?token=<accessToken>
 * Server-Sent Events feed. Authenticated via the access token passed as a
 * query parameter (EventSource cannot set Authorization headers).
 */
router.get('/stream', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) {
    res.status(401).end();
    return;
  }

  try {
    jwt.verify(token, config.jwt.secret);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  realtime.subscribe(res);
});

export default router;