// src/cli/commands/serve.ts

import { startHttpServer } from '../../server/http-server.js';

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = 'localhost';

interface ServeOptions {
  port?: string;
  host?: string;
}

export async function serveCommand(args: string[]): Promise<void> {
  const opts = parseServeArgs(args);
  const port = parseInt(opts.port ?? String(DEFAULT_PORT), 10);
  const host = opts.host ?? DEFAULT_HOST;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${opts.port}`);
    process.exit(1);
  }

  startHttpServer(port, host);

  // Keep process alive
  process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(0); });
  process.on('SIGTERM', () => process.exit(0));
}

function parseServeArgs(args: string[]): ServeOptions {
  const opts: ServeOptions = {};
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      opts.port = args[++i];
    } else if (args[i].startsWith('--port=')) {
      opts.port = args[i].split('=')[1];
    } else if (args[i] === '--host' && args[i + 1]) {
      opts.host = args[++i];
    }
  }
  return opts;
}
