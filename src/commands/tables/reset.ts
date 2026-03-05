import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { updateTable, getTable } from '../../core/config.js';
import { resetTableUsage } from '../../core/usage.js';

export const tablesResetCommand: CommandDefinition = {
  name: 'tables_reset',
  group: 'tables',
  subcommand: 'reset',
  description:
    'Reset a table row counter to zero and update the webhook URL. Use when a Clay table reaches its 50k row limit — duplicate the table in Clay, get the new webhook URL, then run this command.',
  examples: ['clay tables reset enrich-lead --webhook-url https://app.clay.com/webhook/new456'],

  inputSchema: z.object({
    name: z.string().min(1).describe('Table name to reset'),
    webhookUrl: z.string().url().describe('New webhook URL from the duplicated Clay table'),
  }),

  cliMappings: {
    args: [{ field: 'name', name: 'name', required: true, description: 'Table name' }],
    options: [
      { field: 'webhookUrl', flags: '-w, --webhook-url <url>', description: 'New webhook URL' },
    ],
  },

  handler: async (input) => {
    const existing = await getTable(input.name);
    if (!existing) {
      return { error: `Table "${input.name}" not found.` };
    }

    await updateTable(input.name, { webhookUrl: input.webhookUrl });
    await resetTableUsage(input.name, existing.rowLimit);

    return {
      success: true,
      table: input.name,
      newWebhookUrl: input.webhookUrl,
      rowCount: 0,
      rowLimit: existing.rowLimit,
    };
  },
};
