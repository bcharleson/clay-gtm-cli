import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { TablesStore, UsageStore, ListenerState, ClayTable, UsageEntry } from './types.js';

const CONFIG_DIR = join(homedir(), '.clay');
const TABLES_FILE = join(CONFIG_DIR, 'tables.json');
const USAGE_FILE = join(CONFIG_DIR, 'usage.json');
const LISTENER_FILE = join(CONFIG_DIR, 'listener.json');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureConfigDir();
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// --- Global config ---

interface GlobalConfig {
  callbackUrl?: string;
}

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  return readJson<GlobalConfig>(CONFIG_FILE, {});
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await writeJson(CONFIG_FILE, config);
}

// --- Tables ---

export async function loadTables(): Promise<TablesStore> {
  return readJson<TablesStore>(TABLES_FILE, { tables: {} });
}

export async function saveTables(store: TablesStore): Promise<void> {
  await writeJson(TABLES_FILE, store);
}

export async function getTable(name: string): Promise<ClayTable | null> {
  const store = await loadTables();
  return store.tables[name] ?? null;
}

export async function addTable(table: ClayTable): Promise<void> {
  const store = await loadTables();
  store.tables[table.name] = table;
  await saveTables(store);
}

export async function removeTable(name: string): Promise<boolean> {
  const store = await loadTables();
  if (!store.tables[name]) return false;
  delete store.tables[name];
  await saveTables(store);
  return true;
}

export async function updateTable(name: string, updates: Partial<ClayTable>): Promise<ClayTable | null> {
  const store = await loadTables();
  const existing = store.tables[name];
  if (!existing) return null;
  const updated = { ...existing, ...updates, name };
  store.tables[name] = updated;
  await saveTables(store);
  return updated;
}

// --- Usage ---

export async function loadUsage(): Promise<UsageStore> {
  return readJson<UsageStore>(USAGE_FILE, { tables: {} });
}

export async function saveUsage(store: UsageStore): Promise<void> {
  await writeJson(USAGE_FILE, store);
}

export async function getUsage(tableName: string): Promise<UsageEntry> {
  const store = await loadUsage();
  return store.tables[tableName] ?? { count: 0, lastFired: '', limit: 50000 };
}

export async function incrementUsage(tableName: string, limit: number): Promise<UsageEntry> {
  const store = await loadUsage();
  const entry = store.tables[tableName] ?? { count: 0, lastFired: '', limit };
  entry.count += 1;
  entry.lastFired = new Date().toISOString();
  entry.limit = limit;
  store.tables[tableName] = entry;
  await saveUsage(store);
  return entry;
}

export async function resetUsage(tableName: string, limit: number): Promise<void> {
  const store = await loadUsage();
  store.tables[tableName] = { count: 0, lastFired: '', limit };
  await saveUsage(store);
}

// --- Listener state ---

export async function loadListenerState(): Promise<ListenerState | null> {
  return readJson<ListenerState | null>(LISTENER_FILE, null);
}

export async function saveListenerState(state: ListenerState): Promise<void> {
  await writeJson(LISTENER_FILE, state);
}

export async function clearListenerState(): Promise<void> {
  await writeJson(LISTENER_FILE, null);
}

export { CONFIG_DIR, LISTENER_FILE };
