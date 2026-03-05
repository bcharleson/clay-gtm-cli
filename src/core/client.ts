import { WebhookError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

interface RequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function httpRequest<T = unknown>(opts: RequestOptions): Promise<T> {
  const { url, method, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'clay-cli/0.1.0',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        const text = await response.text();
        if (!text) return {} as T;
        return JSON.parse(text) as T;
      }

      if (RETRY_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
        lastError = new WebhookError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      throw new WebhookError(
        `HTTP ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`,
        response.status,
      );
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof WebhookError) throw error;
      if ((error as Error).name === 'AbortError') {
        lastError = new WebhookError(`Request timed out after ${timeoutMs}ms`);
      } else {
        lastError = error as Error;
      }
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
    }
  }

  throw lastError ?? new WebhookError('Request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
