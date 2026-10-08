import { Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Lightweight Server-Sent Events hub used to push live updates
 * (e.g. "a new circular arrived in circularclassifier@gmail.com") to
 * connected browser clients.
 */
class RealtimeHub {
  private clients = new Set<Response>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  subscribe(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(': connected\n\n');
    this.clients.add(res);

    const remove = () => {
      this.clients.delete(res);
      try {
        res.end();
      } catch {
        // already closed
      }
    };

    res.on('close', remove);
    res.on('error', remove);
    res.on('finish', remove);

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.broadcast('heartbeat', { ts: Date.now() });
      }, 25000);
    }
  }

  broadcast(event: string, payload: unknown): void {
    let data: string;
    try {
      data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    } catch (err) {
      logger.warn(`Failed to serialize SSE payload for "${event}"`);
      return;
    }

    const dead: Response[] = [];
    for (const client of this.clients) {
      try {
        client.write(`event: ${event}\ndata: ${data}\n\n`);
      } catch (err) {
        dead.push(client);
      }
    }
    for (const client of dead) {
      this.clients.delete(client);
    }
  }

  newCircular(circular: unknown): void {
    this.broadcast('new-circular', circular);
  }

  dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}

export const realtime = new RealtimeHub();
export default realtime;