import { z } from 'zod';

export interface CliMapping {
  args?: Array<{
    field: string;
    name: string;
    required?: boolean;
    description?: string;
  }>;
  options?: Array<{
    field: string;
    flags: string;
    description?: string;
  }>;
}

export interface CommandDefinition<TInput extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  name: string;
  group: string;
  subcommand: string;
  description: string;
  examples?: string[];
  inputSchema: TInput;
  cliMappings: CliMapping;
  handler: (input: z.infer<TInput>) => Promise<unknown>;
}

export interface ClayTable {
  name: string;
  webhookUrl: string;
  authKey?: string;
  description?: string;
  createdAt: string;
  rowLimit: number;
}

export interface TablesStore {
  tables: Record<string, ClayTable>;
}

export interface UsageEntry {
  count: number;
  lastFired: string;
  limit: number;
}

export interface UsageStore {
  tables: Record<string, UsageEntry>;
}

export interface ListenerState {
  pid: number;
  port: number;
  tunnelUrl: string;
  startedAt: string;
}

export interface CallbackResult {
  id: string;
  receivedAt: string;
  payload: unknown;
}

export interface GlobalOptions {
  pretty?: boolean;
  quiet?: boolean;
  fields?: string;
}
