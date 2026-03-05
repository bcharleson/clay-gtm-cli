import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { updateTable } from '../../core/config.js';

export const tablesUpdateCommand: CommandDefinition = {
  name: 'tables_update',
  group: 'tables',
  subcommand: 'update',
  description: 'Update a registered Clay webhook table (webhook URL, auth key, description, or row limit).',
  examples: [
    'clay tables update enrich-lead --webhook-url https://app.clay.com/webhook/new123',
    'clay tables update enrich-lead --auth-key sk-newkey',
  ],

  inputSchema: z.object({
    name: z.string().min(1).describe('Table name to update'),
    webhookUrl: z.string().url().optional().describe('New webhook URL'),
    authKey: z.string().optional().describe('New auth key'),
    description: z.string().optional().describe('New description'),
    rowLimit: z.coerce.number().min(1).optional().describe('New row limit'),
  }),

  cliMappings: {
    args: [{ field: 'name', name: 'name', required: true, description: 'Table name' }],
    options: [
      { field: 'webhookUrl', flags: '-w, --webhook-url <url>', description: 'New webhook URL' },
      { field: 'authKey', flags: '-k, --auth-key <key>', description: 'New auth key' },
      { field: 'description', flags: '-d, --description <text>', description: 'New description' },
      { field: 'rowLimit', flags: '--row-limit <number>', description: 'New row limit' },
    ],
  },

  handler: async (input) => {
    const { name, ...updates } = input;
    const defined = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));

    if (Object.keys(defined).length === 0) {
      return { error: 'No updates provided. Pass at least one flag (--webhook-url, --auth-key, --description, --row-limit).' };
    }

    const updated = await updateTable(name, defined);
    if (!updated) {
      return { error: `Table "${name}" not found. Run "clay tables list" to see available tables.` };
    }

    return { success: true, table: updated };
  },
};
