/* globals self, clients */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    // fall through to empty payload if JSON parse fails
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/vite.svg',
    badge: data.icon || '/vite.svg',
    data: data.url || '/',
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data || '/';
  const targetUrl = new URL(url, self.location.origin).toString();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Resubscribe if the server rotates subscription keys.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(updateSubscription(event.oldSubscription));
});

async function updateSubscription(oldSubscription) {
  try {
    const { apiBaseUrl } = (await getAuthContext()) || {};
    const registration = await self.registration;
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
    });

    const response = await saveSubscription(newSubscription, apiBaseUrl);
    if (!response.ok) {
      throw new Error('Failed to save updated subscription');
    }
  } catch (err) {
    // Ignore - will retry on next notification.
  }
}

async function getAuthContext() {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windowClients) {
    try {
      const message = await postMessage(client, { type: 'get-access-token' });
      if (message) {
        return message;
      }
    } catch (err) {
      // try next client
    }
  }
  return null;
}

async function getAccessTokenFromClients() {
  const context = await getAuthContext();
  return context ? context.token : null;
}

function postMessage(client, payload) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data);
    client.postMessage(payload, [channel.port2]);
  });
}

async function saveSubscription(subscription, apiBaseUrl) {
  const base = apiBaseUrl || '';
  const endpointUrl = new URL('/api/push/subscribe', base || self.location.origin).toString();

  const accessToken = await getAccessTokenFromClients();
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
    }),
  });
}
