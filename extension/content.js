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

  function observe() {
    console.info('[cc-ext] content script loaded in', window.location.href);

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