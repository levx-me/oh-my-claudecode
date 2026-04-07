// src/server/team-poller.ts
// Polls .omc/state/team/ every POLL_INTERVAL_MS.
// Detects changes by comparing JSON snapshots.
// Calls onSnapshot when a team's state changes.

import { listTeamNames, readTeamSnapshot } from './team-reader.js';
import type { TeamSnapshot } from './types.js';

const POLL_INTERVAL_MS = 1000;

type SnapshotCallback = (snapshot: TeamSnapshot) => void;

export function startTeamPoller(onSnapshot: SnapshotCallback): () => void {
  const lastSeen = new Map<string, string>(); // teamName → serialized hash

  const poll = async () => {
    try {
      const names = await listTeamNames();
      await Promise.all(
        names.map(async (name) => {
          const snapshot = await readTeamSnapshot(name);
          if (!snapshot) return;
          const hash = JSON.stringify(snapshot.workers) + JSON.stringify(snapshot.tasks);
          if (lastSeen.get(name) !== hash) {
            lastSeen.set(name, hash);
            onSnapshot(snapshot);
          }
        })
      );
    } catch {
      // swallow — polling must never crash the server
    }
  };

  const timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
  void poll(); // run immediately on start

  return () => clearInterval(timer);
}
