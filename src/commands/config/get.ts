import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { loadGlobalConfig, loadListenerState } from '../../core/config.js';
import { loadTables } from '../../core/config.js';
import { getAllUsage } from '../../core/usage.js';

export const configGetCommand: CommandDefinition = {
  name: 'config_get',
  group: 'config',
  subcommand: 'get',
  description: 'Show current clay-cli configuration, listener status, and registered tables count.',
  examples: ['clay config get', 'clay config get --pretty'],

  inputSchema: z.object({}),

  cliMappings: {},

  handler: async () => {
    const config = await loadGlobalConfig();
    const listener = await loadListenerState();
    const tablesStore = await loadTables();
    const usage = await getAllUsage();
    const tableCount = Object.keys(tablesStore.tables).length;

    let listenerStatus = 'stopped';
    if (listener) {
      try {
        process.kill(listener.pid, 0);
        listenerStatus = 'running';
      } catch {
        listenerStatus = 'stopped (stale)';
      }
    }

    return {
      callbackUrl: config.callbackUrl ?? null,
      listener: {
        status: listenerStatus,
        tunnelUrl: listener?.tunnelUrl ?? null,
        port: listener?.port ?? null,
      },
      tables: {
        count: tableCount,
        totalRows: Object.values(usage.tables).reduce((sum, u) => sum + u.count, 0),
      },
    };
  },
};
