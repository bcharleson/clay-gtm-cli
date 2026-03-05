import type { GlobalOptions } from './types.js';

export function output(data: unknown, opts: GlobalOptions = {}): void {
  if (opts.quiet) return;

  let result = data;

  if (opts.fields && typeof data === 'object' && data !== null) {
    const fields = opts.fields.split(',').map((f) => f.trim());
    result = filterFields(data, fields);
  }

  const json = opts.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  process.stdout.write(json + '\n');
}

function filterFields(data: unknown, fields: string[]): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => pickFields(item, fields));
  }
  return pickFields(data, fields);
}

function pickFields(obj: unknown, fields: string[]): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) {
      result[field] = record[field];
    }
  }
  return result;
}

export function warn(message: string): void {
  process.stderr.write(`⚠ ${message}\n`);
}

export function info(message: string): void {
  process.stderr.write(`${message}\n`);
}
