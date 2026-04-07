// src/server/team-reader.ts

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  teamReadWorkerStatus,
  teamReadWorkerHeartbeat,
  teamListTasks,
  teamReadConfig,
} from '../team/team-ops.js';
import type { TeamSnapshot, WorkerSnapshot, TaskSummary } from './types.js';

const STATE_ROOT = '.omc/state/team';

export async function listTeamNames(): Promise<string[]> {
  if (!existsSync(STATE_ROOT)) return [];
  try {
    const entries = await readdir(STATE_ROOT, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

export async function readTeamSnapshot(teamName: string): Promise<TeamSnapshot | null> {
  const cwd = process.cwd();
  try {
    const config = await teamReadConfig(teamName, cwd);
    if (!config) return null;

    const workerNames = config.workers.map(w => w.name);

    const workers: WorkerSnapshot[] = await Promise.all(
      workerNames.map(async (name): Promise<WorkerSnapshot> => {
        const [statusResult, heartbeatResult] = await Promise.allSettled([
          teamReadWorkerStatus(teamName, name, cwd),
          teamReadWorkerHeartbeat(teamName, name, cwd),
        ]);
        const s = statusResult.status === 'fulfilled' ? statusResult.value : null;
        const h = heartbeatResult.status === 'fulfilled' ? heartbeatResult.value : null;
        return {
          name,
          status: s?.state ?? 'unknown',
          currentTaskId: s?.current_task_id ?? null,
          lastSeen: s?.updated_at ?? null,
          alive: h?.alive ?? null,
        };
      })
    );

    const tasks = await teamListTasks(teamName, cwd);
    const taskSummary: TaskSummary = {
      pending: 0, in_progress: 0, completed: 0, failed: 0, total: tasks.length,
    };
    for (const t of tasks) {
      const s = t.status as string;
      if (s === 'pending') taskSummary.pending++;
      else if (s === 'in_progress') taskSummary.in_progress++;
      else if (s === 'completed') taskSummary.completed++;
      else if (s === 'failed') taskSummary.failed++;
    }

    return {
      teamName,
      task: config.task,
      workers,
      tasks: taskSummary,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
