import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { CallbackResult } from './types.js';

const callbacks = new Map<string, CallbackResult>();

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function extractCallbackId(url: string): string | null {
  const match = url.match(/^\/callback\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url === '/health') {
    sendJson(res, 200, { status: 'ok', callbacks: callbacks.size });
    return;
  }

  const callbackId = extractCallbackId(url);

  if (!callbackId) {
    sendJson(res, 404, { error: 'Not found. Use POST /callback/:id or GET /callback/:id' });
    return;
  }

  if (method === 'POST') {
    const body = await parseBody(req);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = body;
    }

    const result: CallbackResult = {
      id: callbackId,
      receivedAt: new Date().toISOString(),
      payload,
    };

    callbacks.set(callbackId, result);
    sendJson(res, 200, { success: true, id: callbackId });
    return;
  }

  if (method === 'GET') {
    const result = callbacks.get(callbackId);
    if (!result) {
      sendJson(res, 404, { waiting: true, id: callbackId });
      return;
    }
    callbacks.delete(callbackId);
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 405, { error: `Method ${method} not allowed` });
}

export function startCallbackServer(port: number): Promise<{ port: number; server: Server }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        sendJson(res, 500, { error: String(err) });
      });
    });

    server.listen(port, '0.0.0.0', () => {
      const addr = server.address();
      const resolvedPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ port: resolvedPort, server });
    });

    server.on('error', reject);
  });
}

export function getCallbackStore(): Map<string, CallbackResult> {
  return callbacks;
}
