// src/server/types.ts

import type { ServerResponse } from 'node:http';

export interface WorkerSnapshot {
  name: string;
  status: 'idle' | 'working' | 'blocked' | 'done' | 'failed' | 'draining' | 'unknown';
  currentTaskId: string | null;
  lastSeen: string | null;
  alive: boolean | null;
}

export interface TaskSummary {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  total: number;
}

export interface TeamSnapshot {
  teamName: string;
  task: string;
  workers: WorkerSnapshot[];
  tasks: TaskSummary;
  updatedAt: string;
}

export interface SseClient {
  id: string;
  teamName: string;
  res: ServerResponse;
}
