/** `mm:ss` for the runner's elapsed-time display. Hours roll into minutes
 *  rather than growing a third segment — no quiz runs long enough to need one. */
export function formatElapsedTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
