import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { CommandDefinition } from '../../core/types.js';
import { getTable, loadListenerState } from '../../core/config.js';
import { httpRequest } from '../../core/client.js';
import { assertCanFire, trackFire } from '../../core/usage.js';
import { TimeoutError, ConfigError, ClayError } from '../../core/errors.js';


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
    data: z.string().optional().describe('JSON payload, @file path, or stdin when omitted'),
    wait: z.boolean().default(false).describe('Wait for callback response before returning'),
    timeout: z.coerce.number().default(120).describe('Timeout in seconds when using --wait'),
    dryRun: z.boolean().default(false).describe('Print the payload that would be sent without actually firing'),
  }),

  cliMappings: {
    args: [{ field: 'table', name: 'table', required: true, description: 'Table name' }],
    options: [
      { field: 'data', flags: '-d, --data <json>', description: 'JSON payload, @file path, or "-" for stdin' },
      { field: 'wait', flags: '-w, --wait', description: 'Wait for callback' },
      { field: 'timeout', flags: '-t, --timeout <seconds>', description: 'Timeout in seconds (default: 120)' },
      { field: 'dryRun', flags: '--dry-run', description: 'Print payload without firing' },
    ],
  },

  handler: async (input) => {
    const tableConfig = await getTable(input.table);
    if (!tableConfig) {
      return { error: `Table "${input.table}" not found. Run "clay tables list" to see registered tables.` };
    }

    const rawPayload = await resolvePayloadInput(input.data);
    if (!rawPayload) {
      return { error: "Missing required flag: --data '<json>'" };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return { error: 'Invalid JSON in --data flag. Provide valid JSON.' };
    }

    const callbackId = randomUUID();
    let callbackUrl: string | null = null;

    if (input.wait) {
      const listener = await loadListenerState();
      if (!listener) {
        throw new ConfigError(
          'No listener running. Start one in a separate terminal:\n' +
            '  clay listen start --port 3456\n\n' +
            'Or use tmux:\n' +
            '  tmux new-session -d -s clay-listener \'clay listen start --port 3456\'\n\n' +
            'Then re-run this command.',
        );
      }

      try {
        process.kill(listener.pid, 0);
      } catch {
        throw new ConfigError(
          'Listener process is not running (stale state). Start a new one:\n' +
            '  clay listen start --port 3456',
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

    if (input.dryRun) {
      return {
        dryRun: true,
        table: input.table,
        webhookUrl: tableConfig.webhookUrl,
        payload: webhookPayload,
        message: 'Dry run — payload not sent.',
      };
    }

    await assertCanFire(input.table, tableConfig.rowLimit);

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

    const startTime = Date.now();
    const writeElapsed = () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stderr.write(`\r⏳ Waiting for callback... ${elapsed}s`);
    };

    writeElapsed();

    while (Date.now() < deadline) {
      try {
        const response = await fetch(pollUrl);
        if (response.ok) {
          const body = await response.json();
          if (body && typeof body === 'object' && 'payload' in (body as Record<string, unknown>)) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            process.stderr.write(`\r✅ Callback received (${elapsed}s)     \n`);
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
      writeElapsed();
    }

    process.stderr.write('\n');
    throw new TimeoutError(timeoutMs);
  },
};

async function resolvePayloadInput(data?: string): Promise<string | null> {
  if (data && data !== '-') {
    if (data.startsWith('@')) {
      const filePath = data.slice(1).trim();
      if (!filePath) {
        throw new ClayError('Missing file path after @ in --data. Use --data @payload.json', 'INVALID_INPUT');
      }

      try {
        return await readFile(filePath, 'utf-8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ClayError(`Failed to read payload file "${filePath}": ${message}`, 'INVALID_INPUT');
      }
    }

    return data;
  }

  if (data === '-' || !process.stdin.isTTY) {
    const stdin = await readStdin();
    return stdin.trim() ? stdin : null;
  }

  return null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf-8');
}
