import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { CommandDefinition } from '../../core/types.js';
import { getTable, loadListenerState } from '../../core/config.js';
import { httpRequest } from '../../core/client.js';
import { trackFire } from '../../core/usage.js';
import { TimeoutError, ConfigError } from '../../core/errors.js';
import { warn } from '../../core/output.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

export const fireCommand: CommandDefinition = {
  name: 'fire',
  group: 'fire',
  subcommand: 'fire',
  description:
    'Fire a Clay webhook with a JSON payload. Use --wait to block until the callback returns enriched data.',
  examples: [
    'clay fire enrich-lead --data \'{"linkedin_url": "https://linkedin.com/in/jdoe"}\'',
    'clay fire enrich-lead --data \'{"linkedin_url": "https://linkedin.com/in/jdoe"}\' --wait --timeout 120',
  ],

  inputSchema: z.object({
    table: z.string().min(1).describe('Name of the registered table to fire'),
    data: z.string().min(1).describe('JSON payload to send to the webhook'),
    wait: z.boolean().default(false).describe('Wait for callback response before returning'),
    timeout: z.coerce.number().default(120).describe('Timeout in seconds when using --wait'),
  }),

  cliMappings: {
    args: [{ field: 'table', name: 'table', required: true, description: 'Table name' }],
    options: [
      { field: 'data', flags: '-d, --data <json>', description: 'JSON payload' },
      { field: 'wait', flags: '-w, --wait', description: 'Wait for callback' },
      { field: 'timeout', flags: '-t, --timeout <seconds>', description: 'Timeout in seconds (default: 120)' },
    ],
  },

  handler: async (input) => {
    const tableConfig = await getTable(input.table);
    if (!tableConfig) {
      return { error: `Table "${input.table}" not found. Run "clay tables list" to see registered tables.` };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(input.data);
    } catch {
      return { error: 'Invalid JSON in --data flag. Provide valid JSON.' };
    }

    const callbackId = randomUUID();
    let callbackUrl: string | null = null;

    if (input.wait) {
      const listener = await loadListenerState();
      if (!listener) {
        throw new ConfigError(
          'No listener running. Start one first:\n  clay listen\nThen re-run this command.',
        );
      }

      try {
        process.kill(listener.pid, 0);
      } catch {
        throw new ConfigError(
          'Listener process is not running (stale state). Start a new one:\n  clay listen',
        );
      }

      callbackUrl = `${listener.tunnelUrl}/callback/${callbackId}`;
    }

    const webhookPayload: Record<string, unknown> = { ...payload };
    if (callbackUrl) {
      webhookPayload._callback_url = callbackUrl;
      webhookPayload._callback_id = callbackId;
    }

    const headers: Record<string, string> = {};
    if (tableConfig.authKey) {
      headers['Authorization'] = `Bearer ${tableConfig.authKey}`;
    }

    await httpRequest({
      url: tableConfig.webhookUrl,
      method: 'POST',
      body: webhookPayload,
      headers,
    });

    await trackFire(input.table, tableConfig.rowLimit);

    if (!input.wait) {
      return {
        success: true,
        table: input.table,
        callbackId,
        message: 'Webhook fired (fire-and-forget). No callback listener — use --wait to receive response.',
      };
    }

    const timeoutMs = input.timeout * 1000 || DEFAULT_TIMEOUT_MS;
    const listener = await loadListenerState();
    const pollUrl = `http://localhost:${listener!.port}/callback/${callbackId}`;
    const deadline = Date.now() + timeoutMs;

    warn(`Waiting for callback (timeout: ${input.timeout}s)...`);

    while (Date.now() < deadline) {
      try {
        const response = await fetch(pollUrl);
        if (response.ok) {
          const body = await response.json();
          if (body && typeof body === 'object' && 'payload' in (body as Record<string, unknown>)) {
            return {
              success: true,
              table: input.table,
              callbackId,
              data: (body as Record<string, unknown>).payload,
            };
          }
        }
      } catch {
        // listener not ready yet or connection refused — keep polling
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new TimeoutError(timeoutMs);
  },
};
