#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';

const outfile = 'bridge/serve.cjs';
await mkdir('bridge', { recursive: true });

const external = [
  'fs', 'fs/promises', 'path', 'os', 'util', 'stream', 'events',
  'buffer', 'crypto', 'http', 'https', 'url', 'child_process',
  'assert', 'module', 'net', 'tls', 'dns', 'readline', 'tty',
  'worker_threads', '@ast-grep/napi', 'better-sqlite3', 'jsonc-parser',
];

await esbuild.build({
  entryPoints: ['src/server/http-server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  banner: {
    js: 'const importMetaUrl = require("url").pathToFileURL(__filename);',
  },
  define: { 'import.meta.url': 'importMetaUrl' },
  external,
});
console.log(`Built ${outfile}`);
