import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/authContext';

const SW_PATH = '/sw.js';
const API_URL = import.meta.env.VITE_API_URL || '';

export type NotificationStatus = 'unsupported' | 'unavailable' | 'granted' | 'denied';

function apiUrl(path: string): string {
  return API_URL ? `${API_URL}${path}` : path;
}

/**
 * Manages the Web Push subscription for deadline reminders:
 * - Registers the service worker while signed in.
 * - `enable()` requests permission + subscribes (must be called from a user
 *   gesture like a button click; browsers ignore silent prompts).
 * - `disable()` unsubscribes locally and removes the subscription from the server.
 * - Saves the subscription to the backend so the cron job can push reminders.
 */
export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<NotificationStatus>('unsupported');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus('unsupported');
      setSubscribed(false);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus('unavailable');
  }, [isAuthenticated]);

  // Register the service worker once so it is ready to receive pushes even
  // before the user explicitly enables notifications.
  useEffect(() => {
    if (!isAuthenticated || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(SW_PATH).catch(() => {
      // best-effort; enable() will surface failures
    });
  }, [isAuthenticated]);

  // Respond to the service worker's requests for an access token and API base
  // URL (e.g. when it resubscribes after a pushsubscriptionchange event).
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'get-access-token') {
        const token = localStorage.getItem('accessToken');
        event.ports?.[0]?.postMessage({ token, apiBaseUrl: API_URL });
      }
    }
    navigator.serviceWorker?.addEventListener?.('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener?.('message', handleMessage);
  }, []);

  const refreshState = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSubscribed(false);
      setStatus('unsupported');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setStatus(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unavailable');
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshState();
  }, [isAuthenticated, refreshState]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Fetch the VAPID public key from the backend.
      let publicKey: string;
      try {
        const response = await fetch(apiUrl('/api/push/vapid-public-key'));
        const body = await response.json();
        publicKey = body.publicKey;
        if (!publicKey) {
          setStatus('unavailable');
          return false;
        }
      } catch {
        setStatus('unavailable');
        return false;
      }

      let pushSub = await registration.pushManager.getSubscription();
      if (!pushSub) {
        pushSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      await sendSubscription(pushSub);

      setStatus('granted');
      setSubscribed(true);
      return true;
    } catch {
      setStatus('unavailable');
      return false;
    }
  }, []);

  const disable = useCallback(async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const pushSub = await registration.pushManager.getSubscription();
        if (pushSub) {
          await deleteSubscription(pushSub);
          await pushSub.unsubscribe();
        }
      } catch (err) {
        // fall through; server record is best-effort as well
      }
    }
    setSubscribed(false);
    setStatus('unavailable');
  }, []);

  return { status, subscribed, enable, disable };
}

async function sendSubscription(subscription: PushSubscription): Promise<void> {
  const endpoint = subscription.endpoint;
  const keys = subscription.toJSON().keys;
  const token = localStorage.getItem('accessToken');

  await fetch(apiUrl('/api/push/subscribe'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ endpoint, keys }),
  });
}

async function deleteSubscription(subscription: PushSubscription): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const url = `${apiUrl('/api/push/subscribe')}?endpoint=${encodeURIComponent(subscription.endpoint)}`;

  await fetch(url, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}