(() => {
  const BUTTON_ID = 'cc-ext-open-app';
  const OPEN_MESSAGE = { type: 'OPEN_POPUP' };

  const ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z" stroke="#F5E2E3" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M3.5 8.5 12 14l8.5-5.5" stroke="#F5E2E3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  let button = null;
  let buttonVisible = false;
  let lastCheck = false;

  // Preview overlay: an on-tab popup that embeds the localhost Hub app and a
  // "redirect" button at the bottom that opens the full app when clicked.
  const PREVIEW_ID = 'cc-ext-preview';
  const DEFAULT_APP_URL = 'http://localhost:5173';
  let previewPath = '';

  function isTopFrame() {
    return window.top === window;
  }

  async function appBaseUrl() {
    if (chrome.storage?.sync) {
      try {
        const { appUrl } = await chrome.storage.sync.get('appUrl');
        if (appUrl) return String(appUrl).trim().replace(/\/+$/, '');
      } catch {
        // Fall through to the default.
      }
    }
    return DEFAULT_APP_URL;
  }

  function hidePreview() {
    const el = document.getElementById(PREVIEW_ID);
    if (el) el.remove();
    previewPath = '';
  }

  function buildPreview() {
    const overlay = document.createElement('div');
    overlay.id = PREVIEW_ID;
    overlay.className = 'cc-preview-overlay';

    const panel = document.createElement('div');
    panel.className = 'cc-preview-panel';

    const header = document.createElement('div');
    header.className = 'cc-preview-header';

    const badge = document.createElement('span');
    badge.className = 'cc-preview-logo';
    badge.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M3.5 8.5 12 14l8.5-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const title = document.createElement('span');
    title.className = 'cc-preview-title-text';
    title.textContent = 'Circular Hub — Preview';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cc-preview-close';
    close.setAttribute('aria-label', 'Close preview');
    close.innerHTML = '&times;';
    close.addEventListener('click', hidePreview);

    const frame = document.createElement('iframe');
    frame.className = 'cc-preview-frame';
    frame.title = 'Circular Hub preview';
    frame.allow = 'autoplay';

    const footer = document.createElement('div');
    footer.className = 'cc-preview-footer';

    const redirect = document.createElement('button');
    redirect.type = 'button';
    redirect.className = 'cc-preview-redirect';
    redirect.textContent = 'redirect';
    redirect.addEventListener('click', () => {
      const path = previewPath;
      hidePreview();
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_APP', path });
      } catch (err) {
        // Extension context may be invalidated after a reload; ignore.
      }
    });

    footer.appendChild(redirect);
    header.appendChild(badge);
    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);
    panel.appendChild(frame);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) hidePreview();
    });

    return { overlay, frame };
  }

  function withPreviewParam(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}preview=1`;
  }

  async function showPreview(path) {
    // Only the top frame renders the overlay; child frames just acknowledge.
    if (!isTopFrame()) return true;
    console.info('[cc-ext] showing preview for path', path);
    try {
      previewPath = typeof path === 'string' ? path : '';
      const base = await appBaseUrl();
      const suffix = previewPath ? (previewPath.startsWith('/') ? previewPath : `/${previewPath}`) : '';

      const existing = document.getElementById(PREVIEW_ID);
      if (existing) {
        const frame = existing.querySelector('.cc-preview-frame');
        if (frame) frame.src = withPreviewParam(`${base}${suffix}`);
        return true;
      }

      const { overlay, frame } = buildPreview();
      frame.src = withPreviewParam(`${base}${suffix}`);
      document.documentElement.appendChild(overlay);
      return true;
    } catch (err) {
      console.warn('[cc-ext] could not show preview overlay', err);
      return false;
    }
  }

  function injectPreviewStyles() {
    if (document.getElementById('cc-ext-preview-style')) return;
    const style = document.createElement('style');
    style.id = 'cc-ext-preview-style';
    style.textContent = `
      .cc-preview-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(20, 10, 11, 0.55);
        backdrop-filter: blur(2px);
      }
      .cc-preview-panel {
        display: flex;
        flex-direction: column;
        width: min(960px, 100%);
        height: min(85vh, 760px);
        border-radius: 16px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
        font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif;
      }
      .cc-preview-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #7c4649 0%, #995c60 100%);
        color: #fff;
      }
      .cc-preview-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.2);
        flex-shrink: 0;
      }
      .cc-preview-title-text {
        flex: 1;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cc-preview-close {
        border: none;
        background: transparent;
        color: #fff;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        padding: 0 6px;
      }
      .cc-preview-close:hover {
        color: #f5e2e3;
      }
      .cc-preview-frame {
        flex: 1;
        width: 100%;
        border: none;
        background: #fff;
      }
      .cc-preview-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 12px 16px;
        background: #fbf6f6;
        border-top: 1px solid #f5e2e3;
      }
      .cc-preview-redirect {
        border: none;
        border-radius: 10px;
        padding: 10px 24px;
        background: linear-gradient(135deg, #7c4649 0%, #995c60 100%);
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        letter-spacing: 0.03em;
      }
      .cc-preview-redirect:hover {
        filter: brightness(1.08);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function isHomePage() {
    return !!(
      document.querySelector('.aPL') ||
      document.querySelector('.nH .aeN') ||
      document.querySelector('.A8L') ||
      document.querySelector('[role="main"] .nH') ||
      document.querySelector('.AO')
    );
  }

  function describeMatch() {
    return {
      aPL: !!document.querySelector('.aPL'),
      folderList: !!document.querySelector('.nH .aeN'),
      A8L: !!document.querySelector('.A8L'),
      mainBody: !!document.querySelector('[role="main"] .nH'),
      AO: !!document.querySelector('.AO'),
    };
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) {
      button = document.getElementById(BUTTON_ID);
      return;
    }

    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.title = 'Open circular summary';
    button.setAttribute('aria-label', 'Open circular summary');
    button.innerHTML = ICON_SVG;

    Object.assign(button.style, {
      position: 'fixed',
      right: '28px',
      bottom: '28px',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #7C4649 0%, #995C60 100%)',
      border: 'none',
      boxShadow: '0 8px 22px rgba(124, 70, 73, 0.45), 0 2px 6px rgba(0, 0, 0, 0.18)',
      cursor: 'pointer',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.07)';
      button.style.boxShadow = '0 12px 28px rgba(124, 70, 73, 0.55), 0 3px 8px rgba(0, 0, 0, 0.2)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 8px 22px rgba(124, 70, 73, 0.45), 0 2px 6px rgba(0, 0, 0, 0.18)';
    });

    button.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage(OPEN_MESSAGE);
      } catch (err) {
        // Extension context may be invalidated after a reload; ignore.
      }
    });

    document.documentElement.appendChild(button);
  }

  function setVisible(visible) {
    if (!button) {
      if (!visible) return;
      createButton();
    }
    if (visible === buttonVisible) return;
    buttonVisible = visible;
    button.style.display = visible ? 'flex' : 'none';
  }

  function poll() {
    const home = isHomePage();
    if (home !== lastCheck) {
      lastCheck = home;
      console.info('[cc-ext] home page', home ? 'shown' : 'hidden', describeMatch());
      setVisible(home);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'SHOW_PREVIEW') {
      showPreview(message.path).then((ok) => sendResponse({ ok: Boolean(ok) }));
      return true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById(PREVIEW_ID)) {
      hidePreview();
    }
  });

  function observe() {
    console.info('[cc-ext] content script loaded in', window.location.href);
    injectPreviewStyles();

    // Handles both classic Gmail (article in the top document) and the
    // iframe-based builds where each message lives in its own frame.
    const observer = new MutationObserver(() => {
      if (!isHomePage()) return;
      if (!document.getElementById(BUTTON_ID)) {
        createButton();
        lastCheck = false;
      }
      poll();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Fallback in case MutationObserver misses a transition.
    setInterval(poll, 1500);

    poll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
  } else {
    observe();
  }
})();