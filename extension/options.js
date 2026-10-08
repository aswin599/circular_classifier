const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_API_URL = 'http://localhost:5000';

const appInput = document.getElementById('appUrl');
const apiInput = document.getElementById('apiUrl');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

function isValidUrl(value) {
  return /^https?:\/\/.+/i.test(value);
}

function toOriginPattern(value) {
  try {
    return `${new URL(value).origin}/*`;
  } catch {
    return null;
  }
}

async function ensureHostPermission(value) {
  const pattern = toOriginPattern(value);
  if (!pattern) return true;

  const alreadyGranted = await chrome.permissions.contains({ origins: [pattern] });
  if (alreadyGranted) return true;

  return chrome.permissions.request({ origins: [pattern] });
}

async function init() {
  const { appUrl, apiUrl } = await chrome.storage.sync.get(['appUrl', 'apiUrl']);
  appInput.value = appUrl || DEFAULT_APP_URL;
  apiInput.value = apiUrl || DEFAULT_API_URL;
}

saveBtn.addEventListener('click', async () => {
  const appUrl = appInput.value.trim();
  const apiUrl = apiInput.value.trim();

  if (appUrl && !isValidUrl(appUrl)) {
    statusEl.textContent = 'App URL must start with http:// or https://';
    return;
  }
  if (apiUrl && !isValidUrl(apiUrl)) {
    statusEl.textContent = 'API URL must start with http:// or https://';
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = 'Saving…';

  try {
    if (appUrl && !(await ensureHostPermission(appUrl))) {
      statusEl.textContent = 'Permission denied for the app URL.';
      return;
    }
    if (apiUrl && !(await ensureHostPermission(apiUrl))) {
      statusEl.textContent = 'Permission denied for the API URL.';
      return;
    }

    await chrome.storage.sync.set({ appUrl, apiUrl });
    statusEl.textContent = 'Saved.';
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => {
      statusEl.textContent = '';
    }, 2000);
  }
});

init();
