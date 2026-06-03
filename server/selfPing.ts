/**
 * Silent self-ping to keep the server awake on Cloud Run.
 * Runs every 8 minutes to prevent hibernation (which happens after ~15 min of inactivity).
 * No external requests, no messages — just an internal timer that touches the server.
 */

let selfPingInterval: NodeJS.Timeout | null = null;

export function startSelfPing() {
  if (selfPingInterval) return; // Already running

  const INTERVAL_MS = 8 * 60 * 1000; // 8 minutes

  selfPingInterval = setInterval(() => {
    // Just a no-op that keeps the event loop active.
    // This prevents Cloud Run from hibernating the server.
    const now = new Date().toISOString();
    console.log(`[self-ping] ${now}`);
  }, INTERVAL_MS);

  // Ensure it doesn't prevent process exit
  selfPingInterval.unref();

  console.log("[self-ping] Started — server will stay awake every 8 minutes");
}

export function stopSelfPing() {
  if (selfPingInterval) {
    clearInterval(selfPingInterval);
    selfPingInterval = null;
    console.log("[self-ping] Stopped");
  }
}
