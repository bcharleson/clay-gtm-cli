import { readFileSync } from 'node:fs';

function loadVersion(): string {
  const candidates = [
    new URL('../../package.json', import.meta.url),
    new URL('../package.json', import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string };
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // Try the next known package.json location.
    }
  }

  return '0.0.0';
}

export const CLI_VERSION = loadVersion();
