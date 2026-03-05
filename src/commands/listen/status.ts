import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { loadListenerState } from '../../core/config.js';

export const listenStatusCommand: CommandDefinition = {
  name: 'listen_status',
  group: 'listen',
  subcommand: 'status',
  description: 'Check whether the callback listener is currently running.',
  examples: ['clay listen status'],

  inputSchema: z.object({}),

  cliMappings: {},

  handler: async () => {
    const state = await loadListenerState();
    if (!state) {
      return { running: false, message: 'No listener state found. Run "clay listen start" to begin.' };
    }

    let alive = false;
    try {
      process.kill(state.pid, 0);
      alive = true;
    } catch {
      alive = false;
    }

    return {
      running: alive,
      pid: state.pid,
      port: state.port,
      tunnelUrl: state.tunnelUrl,
      startedAt: state.startedAt,
      message: alive ? 'Listener is running.' : 'Listener process has stopped. Run "clay listen start" to restart.',
    };
  },
};
