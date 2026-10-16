const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_API_URL = 'http://localhost:5000';

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function getSettings() {
  const { appUrl, apiUrl } = await chrome.storage.sync.get(['appUrl', 'apiUrl']);
  return {
    appUrl: normalizeBase(appUrl || DEFAULT_APP_URL),
    apiUrl: normalizeBase(apiUrl || DEFAULT_API_URL),
  };
}

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function pullTokensFromAppTab(appUrl) {
  try {
    const origin = new URL(appUrl).origin;
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    if (!tabs.length || !tabs[0].id) return null;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => ({
        accessToken: localStorage.getItem('accessToken') || '',
        refreshToken: localStorage.getItem('refreshToken') || '',
      }),
    });

    if (result && (result.accessToken || result.refreshToken)) {
      await chrome.storage.local.set(result);
      return result;
    }
  } catch {
    // App tab not open, not scriptable, or host permission not granted.
  }
  return null;
}

async function getValidAccessToken(settings) {
  let { accessToken, refreshToken } = await chrome.storage.local.get(['accessToken', 'refreshToken']);
  accessToken = accessToken || '';
  refreshToken = refreshToken || '';

  if (!accessToken && !refreshToken) {
    const pulled = await pullTokensFromAppTab(settings.appUrl);
    if (pulled) {
      accessToken = pulled.accessToken || '';
      refreshToken = pulled.refreshToken || '';
    }
  }

  if (accessToken) {
    const payload = decodeJwt(accessToken);
    const expiresAt = payload?.exp ? payload.exp * 1000 : 0;
    if (expiresAt && expiresAt - Date.now() > 30 * 1000) {
      return { token: accessToken, role: payload?.role || null };
    }
  }

  if (refreshToken) {
    try {
      const res = await fetch(`${settings.apiUrl}/api/auth/extension-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        await chrome.storage.local.set({ accessToken: data.accessToken });
        const payload = decodeJwt(data.accessToken);
        return { token: data.accessToken, role: payload?.role || null };
      }
      if (res.status === 401) {
        await chrome.storage.local.remove(['accessToken', 'refreshToken']);
      }
    } catch {
      // Network unavailable; fall through to unauthenticated.
    }
  }

  return { token: null, role: null };
}

async function apiRequest(settings, path, options = {}) {
  const { token, role } = await getValidAccessToken(settings);
  if (!token) {
    return { ok: false, needsLogin: true, error: 'Not signed in' };
  }

  try {
    const res = await fetch(`${settings.apiUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        role,
        error: (data && data.error) || `Request failed (${res.status})`,
      };
    }

    return { ok: true, status: res.status, role, data };
  } catch (err) {
    return { ok: false, role, error: err instanceof Error ? err.message : 'Network error' };
  }
}

const disableToolbarPopup = () => {
  if (chrome.action && typeof chrome.action.setPopup === 'function') {
    chrome.action.setPopup({ popup: '' });
  }
};

let lastPopupOpen = 0;

chrome.runtime.onInstalled.addListener(disableToolbarPopup);
chrome.runtime.onStartup.addListener(disableToolbarPopup);

chrome.action.onClicked.addListener(() => {
  // Intentionally does nothing: the summary popup is only opened from the
  // floating button inside Gmail, never from the toolbar icon.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'OPEN_APP') {
    getSettings().then((settings) => {
      const path = typeof message.path === 'string' ? message.path : '';
      const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '';
      chrome.tabs.create({ url: `${settings.appUrl}${suffix}` });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'OPEN_POPUP') {
    // Ignore rapid double-clicks: the popup is already open for ~1s after the
    // first open, and openPopup() rejects if it is still visible.
    if (Date.now() - lastPopupOpen < 1000) {
      sendResponse({ ok: true, alreadyOpen: true });
      return true;
    }

    const openAppFallback = () => {
      getSettings().then((settings) => {
        chrome.tabs.create({ url: settings.appUrl });
        sendResponse({ ok: true, fallback: true });
      });
    };

    const openActionPopup = async () => {
      if (!chrome.action || typeof chrome.action.openPopup !== 'function') {
        openAppFallback();
        return;
      }
      try {
        // Register the popup just-in-time. The toolbar icon intentionally has
        // no popup registered (clicking it does nothing); it is only set for
        // the programmatic openPopup() below, then cleared right after.
        await chrome.action.setPopup({ popup: 'popup.html' });
        await chrome.action.openPopup();
        lastPopupOpen = Date.now();
      } catch {
        openAppFallback();
      } finally {
        disableToolbarPopup();
      }
    };

    openActionPopup().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'AUTH_TOKENS' && sender.tab) {
    const update = {};
    if (typeof message.accessToken === 'string') update.accessToken = message.accessToken;
    if (typeof message.refreshToken === 'string') update.refreshToken = message.refreshToken;
    chrome.storage.local.set(update).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'SHOW_PREVIEW') {
    const handlePreview = async () => {
      const settings = await getSettings();
      const path = typeof message.path === 'string' ? message.path : '';
      const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '';
      const openFallback = () => {
        console.info('[cc-ext] SHOW_PREVIEW: no Gmail tab available, opening app directly');
        chrome.tabs.create({ url: `${settings.appUrl}${suffix}` });
        return { ok: true, fallback: true };
      };

      const pickGmailTab = async () => {
        // Prefer the currently focused Gmail tab, then any Gmail tab in the
        // current window, then any Gmail tab at all.
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (active && active.id && active.url && active.url.startsWith('https://mail.google.com/')) {
          return active;
        }
        const [inWindow] = await chrome.tabs.query({ currentWindow: true, url: 'https://mail.google.com/*' });
        if (inWindow && inWindow.id) return inWindow;
        const [anywhere] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
        return anywhere && anywhere.id ? anywhere : null;
      };

      try {
        const tab = await pickGmailTab();
        if (!tab || !tab.id) return openFallback();
        // frameId 0 targets the top frame, which is the only one that renders
        // the overlay. This avoids relying on whichever frame answers first.
        console.info('[cc-ext] SHOW_PREVIEW: sending to tab', tab.id, path);
        await chrome.tabs.sendMessage(
          tab.id,
          { type: 'SHOW_PREVIEW', path },
          { frameId: 0 }
        );
        return { ok: true, shown: true };
      } catch (err) {
        console.warn('[cc-ext] SHOW_PREVIEW: content script unreachable', err);
        return openFallback();
      }
    };
    handlePreview().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_SUMMARY') {
    getSettings()
      .then((settings) => {
        const query = message.startDate ? `?startDate=${encodeURIComponent(message.startDate)}` : '';
        return apiRequest(settings, `/api/circulars/priority-summary${query}`);
      })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'SYNC_MAILBOX') {
    getSettings()
      .then((settings) => apiRequest(settings, '/api/processor/gmail-sync', { method: 'POST' }))
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
