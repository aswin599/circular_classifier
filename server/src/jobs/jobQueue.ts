import { logger } from '../utils/logger';

interface QueueItem<T> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

type JobHandler<T> = (data: T, jobId: string) => Promise<unknown>;

/**
 * Simple in-process job queue with retry, no external dependencies (no Redis).
 * Suitable for single-instance deployments.
 */
class JobQueue<T> {
  private queue: QueueItem<T>[] = [];
  private handler: JobHandler<T>;
  private isProcessing = false;
  private retryDelayMs = 3000;
  name: string;

  constructor(name: string, handler: JobHandler<T>, retryDelayMs = 3000) {
    this.name = name;
    this.handler = handler;
    this.retryDelayMs = retryDelayMs;
  }

  add(data: T): string {
    const id = `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({ id, data, attempts: 0, maxAttempts: 5, status: 'pending' });
    logger.debug(`[${this.name}] Job ${id} queued`);
    void this.drain();
    return id;
  }

  addBulk(dataItems: T[]): string[] {
    return dataItems.map((data) => this.add(data));
  }

  get size(): number {
    return this.queue.length;
  }

  get stats() {
    return {
      name: this.name,
      queued: this.queue.length,
      processing: this.isProcessing,
    };
  }

  private async drain(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];

        if (item.status === 'completed' || item.status === 'failed') {
          this.queue.shift();
          continue;
        }

        item.status = 'processing';
        item.attempts += 1;

        try {
          await this.handler(item.data, item.id);
          item.status = 'completed';
          logger.debug(`[${this.name}] Job ${item.id} completed`);
          this.queue.shift();
        } catch (err) {
          item.status = 'failed';
          item.error = err instanceof Error ? err.message : String(err);

          if (item.attempts >= item.maxAttempts) {
            logger.error(`[${this.name}] Job ${item.id} permanently failed after ${item.attempts} attempts: ${item.error}`);
            this.queue.shift();
          } else {
            logger.warn(`[${this.name}] Job ${item.id} failed (attempt ${item.attempts}/${item.maxAttempts}), retrying in ${this.retryDelayMs}ms: ${item.error}`);
            this.reinsertForRetry(item);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private reinsertForRetry(item: QueueItem<T>): void {
    this.queue.shift();

    const retryItem: QueueItem<T> = {
      ...item,
      status: 'pending',
    };

    // Re-insert the item back at the front for immediate retry on next drain
    setTimeout(() => {
      if (retryItem.attempts < retryItem.maxAttempts) {
        this.queue.push(retryItem);
        void this.drain();
      }
    }, this.retryDelayMs);
  }

  clear(): void {
    this.queue = [];
  }
}

export { JobQueue };
