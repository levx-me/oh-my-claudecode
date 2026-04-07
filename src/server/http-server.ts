// src/server/http-server.ts

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleListTeams,
  handleGetTeam,
  handleTeamStream,
  handleCreateTeam,
  handleShutdownTeam,
} from './routes.js';
import { broadcastToTeam } from './sse.js';
import { startTeamPoller } from './team-poller.js';

// CORS preflight
function handleOptions(res: ServerResponse): void {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

function route(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://localhost`);
  const parts = url.pathname.replace(/^\//, '').split('/');
  // parts: ['api', 'teams', teamName?, 'stream'?]

  if (method === 'OPTIONS') { handleOptions(res); return; }

  if (parts[0] !== 'api' || parts[1] !== 'teams') {
    res.writeHead(404); res.end('Not found'); return;
  }

  const teamName = parts[2];
  const sub = parts[3];

  if (!teamName) {
    if (method === 'GET') { handleListTeams(req, res).catch(console.error); return; }
    if (method === 'POST') { handleCreateTeam(req, res).catch(console.error); return; }
  }

  if (teamName && !sub) {
    if (method === 'GET') { handleGetTeam(req, res, teamName).catch(console.error); return; }
  }

  if (teamName && sub === 'stream' && method === 'GET') {
    handleTeamStream(req, res, teamName); return;
  }

  if (teamName && sub === 'shutdown' && method === 'POST') {
    handleShutdownTeam(req, res, teamName).catch(console.error); return;
  }

  res.writeHead(404); res.end('Not found');
}

export function startHttpServer(port: number, host: string): () => void {
  const server = createServer(route);

  // Start poller — broadcast changes to SSE clients
  const stopPoller = startTeamPoller((snapshot) => {
    broadcastToTeam(snapshot.teamName, { type: 'snapshot', ...snapshot });
  });

  server.listen(port, host, () => {
    console.log(`omc serve listening on http://${host}:${port}`);
    console.log(`  GET  /api/teams`);
    console.log(`  GET  /api/teams/:name`);
    console.log(`  GET  /api/teams/:name/stream  (SSE)`);
    console.log(`  POST /api/teams               { workers, task }`);
    console.log(`  POST /api/teams/:name/shutdown`);
  });

  return () => {
    stopPoller();
    server.close();
  };
}
