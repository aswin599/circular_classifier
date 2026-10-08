import { Router, Request, Response } from 'express';
import { User } from '../../models/User';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { issueAccessToken, issueRefreshToken } from '../../utils/jwt';
import { authenticate, AuthRequest } from '../../middleware/auth';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  isGoogleConfigured,
  refreshGoogleAccessToken,
} from '../../services/googleService';
import { importCircularsFromGmail } from '../../services/gmailCircularService';

const router = Router();

// Redirect to Google consent screen
router.get('/', (_req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    res.status(400).json({
      error:
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env',
    });
    return;
  }

  const redirectUri = generateAuthUrl();
  res.redirect(redirectUri);
});

// Google OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  const failRedirect = `${config.clientUrl}/login?error=google_auth_failed`;

  if (error || typeof code !== 'string') {
    logger.error(`Google OAuth error: ${String(error || 'missing code')}`);
    res.redirect(failRedirect);
    return;
  }

  try {
    const { tokens, profile } = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      throw new Error('No access token from Google');
    }
    if (!tokens.refresh_token) {
      // Google returns a refresh token only on the first consent.
      // If a user exists from a previous grant attempt but lost its refresh token,
      // we still proceed if they already have tokens stored.
      logger.warn('No refresh token returned by Google for user, may need to re-consent');
    }

    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { email: profile.email }],
    }).select('+googleRefreshToken');

    const now = new Date();
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(now.getTime() + 3600 * 1000);

    const userRole = profile.email.toLowerCase() === 'circularclassifier@gmail.com' ? 'ADMIN' : 'STUDENT';

    if (!user) {
      user = await User.create({
        email: profile.email,
        fullName: profile.name,
        role: userRole,
        isActive: true,
        googleId: profile.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleTokenExpiry: tokenExpiry,
        googleProfilePicture: profile.picture,
        authProvider: 'google',
      });
    } else {
      user.role = userRole;
      user.googleId = profile.id;
      user.googleAccessToken = tokens.access_token;
      user.googleTokenExpiry = tokenExpiry;
      user.authProvider = 'google';
      // Preserve existing refresh token when Google omits it on re-consent.
      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }
      if (profile.picture) {
        user.googleProfilePicture = profile.picture;
      }
      if (!user.fullName) {
        user.fullName = profile.name;
      }
      await user.save();
    }

    const accessToken = issueAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const refreshToken = issueRefreshToken({ id: user._id.toString() });

    await User.findByIdAndUpdate(user._id, { refreshToken });

    const tokensParam = new URLSearchParams({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    res.redirect(`${config.clientUrl}/google-auth-success?${tokensParam.toString()}`);
  } catch (err) {
    logger.error('Google callback failed:', err);
    res.redirect(failRedirect);
  }
});

// Check if Google login is configured/enabled
router.get('/status', (_req: Request, res: Response) => {
  res.json({ enabled: isGoogleConfigured() });
});

// Authenticated: import circulars from Gmail. Restricted to the designated
// circulars mailbox (admin) so personal student accounts are never scanned.
router.post('/fetch', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const isDesignatedMailbox =
      config.email.user && req.user.email.toLowerCase() === config.email.user.toLowerCase();
    if (req.user.role !== 'ADMIN' && !isDesignatedMailbox) {
      res.status(403).json({ error: 'Fetching circulars is restricted to the designated circulars mailbox' });
      return;
    }

    const result = await importCircularsFromGmail(req.user.id, {
      query: typeof req.body?.query === 'string' ? req.body.query : undefined,
      limit: typeof req.body?.limit === 'number' ? req.body.limit : undefined,
    });

    const message = result.saved > 0
      ? `Successfully imported ${result.saved} new circular(s) (${result.skippedNonCirculars} non-circulars filtered out)`
      : result.circularsFound > 0
      ? `All ${result.circularsFound} circulars found in Gmail were already up to date (${result.duplicates} duplicates)`
      : `Scanned ${result.fetched} emails; no new circulars found (${result.skippedNonCirculars} non-circular emails filtered out)`;

    res.json({
      success: true,
      message,
      ...result,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    logger.error('Google Gmail fetch failed:', e);

    if (e.code === 'NO_GOOGLE_TOKENS') {
      res.status(400).json({ error: e.message, needsReauth: true });
      return;
    }

    res.status(500).json({ error: `Failed to fetch from Gmail: ${e.message}` });
  }
});

// Authenticated: check/manage the user's Gmail connection
router.get('/connection', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(req.user.id).select(
      '+authProvider +googleAccessToken +googleRefreshToken +googleTokenExpiry'
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hasTokens = Boolean(user.googleRefreshToken || user.googleAccessToken);
    const expiresAt = user.googleTokenExpiry || null;
    const needsRefresh =
      hasTokens && expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : hasTokens;

    res.json({
      connected: hasTokens,
      authProvider: user.authProvider,
      expiresAt,
      needsRefresh,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Gmail connection' });
  }
});

// Authenticated: refresh Gmail access token if present
router.post('/refresh-token', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(req.user.id).select('+googleRefreshToken');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.googleRefreshToken) {
      res.status(400).json({ error: 'No Google refresh token available' });
      return;
    }

    const refreshed = await refreshGoogleAccessToken(user.googleRefreshToken);
    user.googleAccessToken = refreshed.accessToken;
    user.googleTokenExpiry = refreshed.expiryDate;
    await user.save();

    res.json({ success: true, expiresAt: refreshed.expiryDate });
  } catch (err) {
    logger.error('Google token refresh failed:', err);
    res.status(500).json({ error: 'Failed to refresh Google token' });
  }
});

// Authenticated: disconnect Gmail
router.post('/disconnect', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;