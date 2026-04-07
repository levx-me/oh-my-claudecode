// src/server/sse.ts

import type { ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { SseClient } from './types.js';

const clients = new Map<string, SseClient>();

export function addSseClient(teamName: string, res: ServerResponse): string {
  const id = randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(':ok\n\n'); // initial ping
  clients.set(id, { id, teamName, res });
  res.on('close', () => clients.delete(id));
  return id;
}

export function broadcastToTeam(teamName: string, data: unknown): void {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    if (client.teamName === teamName) {
      try {
        client.res.write(payload);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

export function clientCount(teamName: string): number {
  let count = 0;
  for (const c of clients.values()) {
    if (c.teamName === teamName) count++;
  }
  return count;
}
