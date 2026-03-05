import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const usageSyncCommand: CommandDefinition = {
  name: 'usage_sync',
  group: 'usage',
  subcommand: 'sync',
  description: 'Sync row counts with remote Cloudflare KV store. (Planned for v2 — currently a no-op.)',
  examples: ['clay usage sync'],

  inputSchema: z.object({}),

  cliMappings: {},

  handler: async () => {
    return {
      success: true,
      message: 'KV sync is planned for v2. Row counts are currently tracked locally at ~/.clay/usage.json.',
    };
  },
};
