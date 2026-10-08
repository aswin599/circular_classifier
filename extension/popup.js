const SUMMARY_DAYS = 3;

const els = {
  state: document.getElementById('state'),
  table: document.getElementById('summary'),
  sync: document.getElementById('sync'),
  syncLabel: document.getElementById('sync-label'),
  status: document.getElementById('status'),
  openApp: document.getElementById('open-app'),
};

let startDate = '';
let role = null;
let syncing = false;

function sendMessage(message) {
  return new Promise((resolve) => {
    if (!chrome?.runtime?.id) {
      resolve({ ok: false, error: 'Extension context unavailable. Reload the extension.' });
      return;
    }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from extension' });
    });
  });
}

function computeStartDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showState(text) {
  els.state.textContent = text;
  els.state.classList.remove('hidden');
  els.table.classList.add('hidden');
}

function renderCounts(counts) {
  els.state.classList.add('hidden');
  els.table.classList.remove('hidden');

  for (const row of els.table.querySelectorAll('tr[data-key]')) {
    const key = row.getAttribute('data-key');
    const value = Number(counts?.[key] ?? 0);
    const countEl = row.querySelector('.count');
    countEl.textContent = String(value);
    row.classList.toggle('empty', value === 0);
  }
}

function setSyncBusy(busy, label) {
  syncing = busy;
  els.sync.disabled = busy;
  els.syncLabel.textContent = label || (busy ? 'Syncing…' : 'Sync mailbox');
}

function openApp(path = '') {
  sendMessage({ type: 'OPEN_APP', path });
}

async function fetchSummary() {
  const response = await sendMessage({ type: 'GET_SUMMARY', startDate });
  role = response.role || role;
  return response;
}

async function refreshCounts() {
  const response = await fetchSummary();
  if (response.ok) {
    renderCounts(response.data?.counts);
  } else if (response.needsLogin) {
    showState('Open the Circular Hub app and sign in to view your circulars.');
  } else {
    showState(response.error || 'Could not load circular counts.');
  }
  return response;
}

async function runSync({ initial = false } = {}) {
  if (syncing) return;

  setSyncBusy(true, initial ? 'Initial sync…' : 'Syncing…');
  els.status.textContent = 'Fetching new circulars from your mailbox…';

  const response = await sendMessage({ type: 'SYNC_MAILBOX' });

  if (response.ok) {
    const saved = Number(response.data?.saved ?? 0);
    els.status.textContent = saved > 0 ? `Imported ${saved} new circular(s).` : 'Mailbox is up to date.';
  } else if (response.needsLogin) {
    els.status.textContent = 'Sign in to the Circular Hub app to sync.';
  } else {
    els.status.textContent = response.error || 'Sync failed.';
  }

  setSyncBusy(false);
  await refreshCounts();
}

async function init() {
  startDate = computeStartDate(SUMMARY_DAYS);

  // Render the table immediately so the popup always shows content, even if
  // the background service worker is still waking up.
  renderCounts({ high: 0, medium: 0, low: 0 });
  els.sync.disabled = false;

  try {
    const response = await refreshCounts();
    els.sync.hidden = role !== 'ADMIN';

    if (!response.ok) return;

    const { initialSyncDone } = await chrome.storage.local.get('initialSyncDone');
    if (!initialSyncDone) {
      // First ever open of the popup kicks off a one-time mailbox sync.
      if (role === 'ADMIN') {
        await runSync({ initial: true });
      }
      await chrome.storage.local.set({ initialSyncDone: true });
    }
  } catch (error) {
    showState(error instanceof Error ? error.message : 'Something went wrong.');
  }
}

for (const row of document.querySelectorAll('tr[data-priority]')) {
  row.addEventListener('click', () => {
    const priority = row.getAttribute('data-priority');
    const params = new URLSearchParams({ priority, startDate });
    openApp(`/?${params.toString()}`);
  });
}

els.sync.addEventListener('click', () => runSync());
els.openApp.addEventListener('click', () => openApp());

init();
