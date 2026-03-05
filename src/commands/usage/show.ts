import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { getTableUsage, getAllUsage } from '../../core/usage.js';
import { loadTables } from '../../core/config.js';

export const usageShowCommand: CommandDefinition = {
  name: 'usage_show',
  group: 'usage',
  subcommand: 'show',
  description: 'Show row usage for all tables or a specific table. Helps track the 50k row limit.',
  examples: ['clay usage', 'clay usage show enrich-lead'],

  inputSchema: z.object({
    name: z.string().optional().describe('Specific table name (omit for all tables)'),
  }),

  cliMappings: {
    args: [{ field: 'name', name: 'name', required: false, description: 'Table name' }],
  },

  handler: async (input) => {
    if (input.name) {
      const usage = await getTableUsage(input.name);
      return {
        table: input.name,
        rowsUsed: usage.count,
        rowLimit: usage.limit,
        remaining: usage.limit - usage.count,
        percentUsed: Math.round((usage.count / usage.limit) * 100),
        lastFired: usage.lastFired || null,
      };
    }

    const tablesStore = await loadTables();
    const allUsage = await getAllUsage();
    const tables = Object.keys(tablesStore.tables);

    const result = tables.map((name) => {
      const u = allUsage.tables[name] ?? { count: 0, limit: 50000, lastFired: '' };
      return {
        table: name,
        rowsUsed: u.count,
        rowLimit: u.limit,
        remaining: u.limit - u.count,
        percentUsed: Math.round((u.count / u.limit) * 100),
      };
    });

    return { tables: result };
  },
};
