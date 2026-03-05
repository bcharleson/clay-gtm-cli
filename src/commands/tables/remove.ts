import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { removeTable } from '../../core/config.js';

export const tablesRemoveCommand: CommandDefinition = {
  name: 'tables_remove',
  group: 'tables',
  subcommand: 'remove',
  description: 'Remove a registered Clay webhook table from the local registry.',
  examples: ['clay tables remove enrich-lead'],

  inputSchema: z.object({
    name: z.string().min(1).describe('Table name to remove'),
  }),

  cliMappings: {
    args: [{ field: 'name', name: 'name', required: true, description: 'Table name' }],
  },

  handler: async (input) => {
    const removed = await removeTable(input.name);
    if (!removed) {
      return { error: `Table "${input.name}" not found.` };
    }
    return { success: true, removed: input.name };
  },
};
