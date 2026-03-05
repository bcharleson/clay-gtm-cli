export class ClayError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'ClayError';
  }
}

export class WebhookError extends ClayError {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message, 'WEBHOOK_ERROR');
    this.name = 'WebhookError';
  }
}

export class TimeoutError extends ClayError {
  constructor(public timeoutMs: number) {
    super(`Callback timed out after ${timeoutMs / 1000}s`, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class LimitError extends ClayError {
  constructor(
    public tableName: string,
    public count: number,
    public limit: number,
  ) {
    super(
      `Table "${tableName}" has reached its row limit (${count}/${limit}). ` +
        `Run: clay tables reset ${tableName} --webhook-url <new-url>`,
      'ROW_LIMIT',
    );
    this.name = 'LimitError';
  }
}

export class ConfigError extends ClayError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export class ListenerError extends ClayError {
  constructor(message: string) {
    super(message, 'LISTENER_ERROR');
    this.name = 'ListenerError';
  }
}

export function formatError(error: unknown): { error: string; code: string } {
  if (error instanceof ClayError) {
    return { error: error.message, code: error.code };
  }
  const msg = error instanceof Error ? error.message : String(error);
  return { error: msg, code: 'UNKNOWN_ERROR' };
}
