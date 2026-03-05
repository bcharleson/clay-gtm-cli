import { spawn } from 'node:child_process';
import { ListenerError } from './errors.js';

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const TUNNEL_TIMEOUT_MS = 30_000;

export function startTunnel(localPort: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${localPort}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new ListenerError('cloudflared tunnel timed out after 30s. Is cloudflared installed?'));
      }
    }, TUNNEL_TIMEOUT_MS);

    function scanForUrl(data: Buffer): void {
      const text = data.toString();
      const match = text.match(TUNNEL_URL_REGEX);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(match[0]);
      }
    }

    child.stdout.on('data', scanForUrl);
    child.stderr.on('data', scanForUrl);

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new ListenerError(
              'cloudflared not found. Install it:\n' +
                '  macOS:  brew install cloudflared\n' +
                '  Linux:  sudo apt install cloudflared\n' +
                '  Other:  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
            ),
          );
        } else {
          reject(new ListenerError(`cloudflared error: ${err.message}`));
        }
      }
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new ListenerError(`cloudflared exited with code ${code} before providing a tunnel URL`));
      }
    });

    process.on('exit', () => child.kill());
    process.on('SIGINT', () => child.kill());
    process.on('SIGTERM', () => child.kill());
  });
}
