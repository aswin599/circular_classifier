(() => {
  let hadTokens = false;

  function readTokens() {
    try {
      return {
        accessToken: localStorage.getItem('accessToken') || '',
        refreshToken: localStorage.getItem('refreshToken') || '',
      };
    } catch {
      return { accessToken: '', refreshToken: '' };
    }
  }

  function pushTokens() {
    const tokens = readTokens();
    const hasTokens = Boolean(tokens.accessToken || tokens.refreshToken);
    // Also push an empty update when tokens disappear (logout) so the
    // extension cannot keep using a signed-out session.
    if (!hasTokens && !hadTokens) return;
    hadTokens = hasTokens;
    try {
      chrome.runtime.sendMessage({ type: 'AUTH_TOKENS', ...tokens });
    } catch {
      // Extension context invalidated after a reload; ignore.
    }
  }

  pushTokens();
  window.addEventListener('storage', pushTokens);
  window.addEventListener('focus', pushTokens);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pushTokens();
  });
  setInterval(pushTokens, 10000);
})();
