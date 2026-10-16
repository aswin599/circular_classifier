import { useEffect, useRef } from 'react';

export interface NewCircularEvent {
  id: string;
  subject: string;
  categoryName?: string;
  priority?: string;
  receivedDate?: string;
  expireDate?: string;
  expirySource?: string;
  excerpt?: string;
  attachments?: { filename: string; fileType: string }[];
}

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

/**
 * Opens a Server-Sent Events connection to /api/stream using the access token
 * as a query parameter (EventSource cannot send Authorization headers).
 * Auto-reconnects while the token exists. Callers are responsible for cleaning
 * up via the returned cancel().
 */
export function createCircularStream(
  token: string,
  handlers: {
    onNewCircular: (event: NewCircularEvent) => void;
    onError?: () => void;
  }
): () => void {
  let source: EventSource | null = null;
  let stopped = false;

  const connect = () => {
    if (stopped || !token) return;

    source = new EventSource(`${API_URL}/api/stream?token=${encodeURIComponent(token)}`);

    source.addEventListener('new-circular', (msg: MessageEvent) => {
      try {
        const event = JSON.parse(msg.data) as NewCircularEvent;
        handlers.onNewCircular(event);
      } catch {
        // Ignore malformed frames
      }
    });

    source.onerror = () => {
      handlers.onError?.();
      source?.close();
      if (!stopped) {
        setTimeout(connect, 5000);
      }
    };
  };

  connect();

  return () => {
    stopped = true;
    source?.close();
  };
}

export function useCircularStream(onNewCircular: (event: NewCircularEvent) => void) {
  const handlerRef = useRef(onNewCircular);
  handlerRef.current = onNewCircular;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    return createCircularStream(token, {
      onNewCircular: (event) => handlerRef.current(event),
    });
  }, []);
}