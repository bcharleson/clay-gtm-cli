import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { loadGlobalConfig, saveGlobalConfig } from '../../core/config.js';

export const configSetCommand: CommandDefinition = {
  name: 'config_set',
  group: 'config',
  subcommand: 'set',
  description: 'Set a global configuration value (e.g. a permanent callback URL).',
  examples: ['clay config set --callback-url https://my-tunnel.example.com'],

  inputSchema: z.object({
    callbackUrl: z.string().url().optional().describe('Permanent callback base URL (overrides auto-tunnel)'),
  }),

  cliMappings: {
    options: [
      { field: 'callbackUrl', flags: '--callback-url <url>', description: 'Permanent callback URL' },
    ],
  },

  handler: async (input) => {
    if (!input.callbackUrl) {
      return { error: 'No values provided. Use --callback-url to set a value.' };
    }

    const config = await loadGlobalConfig();
    config.callbackUrl = input.callbackUrl;
    await saveGlobalConfig(config);
    return { success: true, config };
  },
};
