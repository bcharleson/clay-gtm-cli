import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { getTable } from '../../core/config.js';
import { getTableUsage } from '../../core/usage.js';

export const tablesGetCommand: CommandDefinition = {
  name: 'tables_get',
  group: 'tables',
  subcommand: 'get',
  description: 'Get details for a specific Clay webhook table including usage stats.',
  examples: ['clay tables get enrich-lead'],

  inputSchema: z.object({
    name: z.string().min(1).describe('Table name'),
  }),

  cliMappings: {
    args: [{ field: 'name', name: 'name', required: true, description: 'Table name' }],
  },

  handler: async (input) => {
    const table = await getTable(input.name);
    if (!table) {
      return { error: `Table "${input.name}" not found. Run "clay tables list" to see available tables.` };
    }

    const usage = await getTableUsage(input.name);
    return {
      ...table,
      rowsUsed: usage.count,
      remaining: table.rowLimit - usage.count,
      lastFired: usage.lastFired || null,
    };
  },
};
