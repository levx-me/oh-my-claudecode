// src/server/routes.ts

import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { listTeamNames, readTeamSnapshot } from './team-reader.js';
import { addSseClient } from './sse.js';

const execFileAsync = promisify(execFile);

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

// GET /api/teams
export async function handleListTeams(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const names = await listTeamNames();
  json(res, 200, { teams: names });
}

// GET /api/teams/:name
export async function handleGetTeam(
  _req: IncomingMessage,
  res: ServerResponse,
  teamName: string
): Promise<void> {
  const snapshot = await readTeamSnapshot(teamName);
  if (!snapshot) {
    json(res, 404, { error: `Team '${teamName}' not found` });
    return;
  }
  json(res, 200, snapshot);
}

// GET /api/teams/:name/stream  (SSE)
export function handleTeamStream(
  _req: IncomingMessage,
  res: ServerResponse,
  teamName: string
): void {
  addSseClient(teamName, res);
  // Send current snapshot immediately on connect
  readTeamSnapshot(teamName).then((snapshot) => {
    if (snapshot) {
      res.write(`data: ${JSON.stringify({ type: 'snapshot', ...snapshot })}\n\n`);
    }
  }).catch(() => {});
}

// POST /api/teams  body: { workers: "3:executor", task: "fix auth bug" }
export async function handleCreateTeam(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readBody(req);
  let parsed: { workers?: string; task?: string };
  try {
    parsed = JSON.parse(body) as { workers?: string; task?: string };
  } catch {
    json(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  const { workers, task } = parsed;
  if (!workers || !task) {
    json(res, 400, { error: 'Required: workers (e.g. "3:executor"), task (string)' });
    return;
  }
  try {
    const { stdout } = await execFileAsync('omc', ['team', workers, task], {
      timeout: 10_000,
    });
    json(res, 201, { ok: true, output: stdout });
  } catch (err) {
    json(res, 500, { error: String(err) });
  }
}

// POST /api/teams/:name/shutdown
export async function handleShutdownTeam(
  _req: IncomingMessage,
  res: ServerResponse,
  teamName: string
): Promise<void> {
  try {
    await execFileAsync('omc', ['team', 'shutdown', teamName], { timeout: 30_000 });
    json(res, 200, { ok: true });
  } catch (err) {
    json(res, 500, { error: String(err) });
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
