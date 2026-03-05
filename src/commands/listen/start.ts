import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { startCallbackServer } from '../../core/listener.js';
import { startTunnel } from '../../core/tunnel.js';
import { saveListenerState, loadGlobalConfig } from '../../core/config.js';
import { info } from '../../core/output.js';
import { ListenerError } from '../../core/errors.js';

export const listenStartCommand: CommandDefinition = {
  name: 'listen_start',
  group: 'listen',
  subcommand: 'start',
  description:
    'Start the callback listener — a local HTTP server tunneled via cloudflared. Clay tables POST enriched data back to this URL.',
  examples: ['clay listen start', 'clay listen start --port 9876'],

  inputSchema: z.object({
    port: z.coerce.number().min(1024).max(65535).default(0).describe('Port for local server (0 = random available)'),
  }),

  cliMappings: {
    options: [
      { field: 'port', flags: '-p, --port <number>', description: 'Local port (default: random)' },
    ],
  },

  handler: async (input) => {
    const globalConfig = await loadGlobalConfig();

    if (globalConfig.callbackUrl) {
      info(`Using permanent callback URL: ${globalConfig.callbackUrl}`);
      info('Skipping cloudflared tunnel. Starting local server only.');
    }

    const { port, server } = await startCallbackServer(input.port || 0);

    let tunnelUrl: string;

    if (globalConfig.callbackUrl) {
      tunnelUrl = globalConfig.callbackUrl;
    } else {
      try {
        tunnelUrl = await startTunnel(port);
      } catch (error) {
        server.close();
        throw new ListenerError(
          `Failed to start cloudflared tunnel: ${(error as Error).message}\n` +
            'Install cloudflared: brew install cloudflared (macOS) or apt install cloudflared (Linux)',
        );
      }
    }

    await saveListenerState({
      pid: process.pid,
      port,
      tunnelUrl,
      startedAt: new Date().toISOString(),
    });

    info(`\nCallback listener running:`);
    info(`  Local:  http://localhost:${port}`);
    info(`  Tunnel: ${tunnelUrl}`);
    info(`\nSet this as the HTTP API callback URL in your Clay table:`);
    info(`  ${tunnelUrl}/callback/<your-callback-id>`);
    info(`\nThe _callback_url field is auto-injected when using "clay fire --wait".`);
    info(`Press Ctrl+C to stop.\n`);

    await new Promise<void>((resolve) => {
      const shutdown = () => {
        server.close();
        resolve();
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });

    return { stopped: true };
  },
};
