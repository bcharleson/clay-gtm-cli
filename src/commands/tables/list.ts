import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { loadTables } from '../../core/config.js';
import { getTableUsage } from '../../core/usage.js';

export const tablesListCommand: CommandDefinition = {
  name: 'tables_list',
  group: 'tables',
  subcommand: 'list',
  description: 'List all registered Clay webhook tables with their webhook URLs and row usage.',
  examples: ['clay tables list', 'clay tables list --pretty'],

  inputSchema: z.object({}),

  cliMappings: {},

  handler: async () => {
    const store = await loadTables();
    const tables = Object.values(store.tables);

    const result = await Promise.all(
      tables.map(async (t) => {
        const usage = await getTableUsage(t.name);
        return {
          name: t.name,
          webhookUrl: t.webhookUrl,
          description: t.description ?? '',
          rowsUsed: usage.count,
          rowLimit: t.rowLimit,
          remaining: t.rowLimit - usage.count,
        };
      }),
    );

    return { tables: result, count: result.length };
  },
};
