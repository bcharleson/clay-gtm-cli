import { getUsage, incrementUsage, resetUsage, loadUsage } from './config.js';
import { LimitError } from './errors.js';
import { warn } from './output.js';

const WARNING_THRESHOLD = 0.9;

export async function trackFire(tableName: string, limit: number): Promise<void> {
  const entry = await incrementUsage(tableName, limit);
  const ratio = entry.count / entry.limit;

  if (ratio >= 1) {
    throw new LimitError(tableName, entry.count, entry.limit);
  }

  if (ratio >= WARNING_THRESHOLD) {
    const remaining = entry.limit - entry.count;
    warn(
      `Table "${tableName}" is at ${entry.count}/${entry.limit} rows (${remaining} remaining). ` +
        `Duplicate the Clay table and run: clay tables reset ${tableName} --webhook-url <new-url>`,
    );
  }
}

export async function getTableUsage(tableName: string) {
  return getUsage(tableName);
}

export async function getAllUsage() {
  return loadUsage();
}

export async function resetTableUsage(tableName: string, limit: number) {
  await resetUsage(tableName, limit);
}
