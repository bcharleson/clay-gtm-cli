import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { addTable, getTable } from '../../core/config.js';

export const tablesAddCommand: CommandDefinition = {
  name: 'tables_add',
  group: 'tables',
  subcommand: 'add',
  description: 'Register a Clay webhook table. Provide the name, webhook URL, and optional auth key.',
  examples: [
    'clay tables add --name enrich-lead --webhook-url https://app.clay.com/webhook/abc123',
    'clay tables add --name find-email --webhook-url https://app.clay.com/webhook/xyz --auth-key sk-123 --description "Waterfall email finder"',
  ],

  inputSchema: z.object({
    name: z.string().min(1).describe('Unique name for this table (used as identifier in all commands)'),
    webhookUrl: z.string().url().describe('Clay webhook URL for this table'),
    authKey: z.string().optional().describe('Optional Bearer token for webhook auth'),
    description: z.string().optional().describe('Human-readable description of what this table does'),
    rowLimit: z.coerce.number().min(1).default(50000).describe('Max rows before reset is needed'),
  }),

  cliMappings: {
    options: [
      { field: 'name', flags: '-n, --name <name>', description: 'Table name' },
      { field: 'webhookUrl', flags: '-w, --webhook-url <url>', description: 'Clay webhook URL' },
      { field: 'authKey', flags: '-k, --auth-key <key>', description: 'Optional auth key' },
      { field: 'description', flags: '-d, --description <text>', description: 'Description' },
      { field: 'rowLimit', flags: '--row-limit <number>', description: 'Row limit (default: 50000)' },
    ],
  },

  handler: async (input) => {
    const existing = await getTable(input.name);
    if (existing) {
      return { error: `Table "${input.name}" already exists. Use "clay tables update" to modify it.` };
    }

    const table = {
      name: input.name,
      webhookUrl: input.webhookUrl,
      authKey: input.authKey,
      description: input.description,
      createdAt: new Date().toISOString(),
      rowLimit: input.rowLimit,
    };

    await addTable(table);
    return { success: true, table };
  },
};
