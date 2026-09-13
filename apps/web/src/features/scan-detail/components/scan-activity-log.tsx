import type { ScanLog, UserBasic } from '@sector/api-client';
import { userDisplayName } from '@sector/api-client';

import { formatDateTime } from '@/lib/format';

type ScanActivityLogProps = {
  /** The audit trail. `scanLogs` is the live one; `logs` is deprecated server-side. */
  scanLogs: ScanLog[];
  logs: ScanLog[];
};

/**
 * The audit trail, collapsed.
 *
 * It is background evidence — who reviewed, when a note landed, when files were
 * replaced — useful when something looks wrong and noise the rest of the time,
 * so it ships closed. A native <details> keeps it keyboard- and
 * screen-reader-operable without a disclosure library.
 */
export function ScanActivityLog({ scanLogs, logs }: ScanActivityLogProps) {
  // Both arrays hold the same shape. `logs` is marked TO BE DEPRECATED in the
  // server code but still carries entries on older scans, so both are shown.
  const entries = [...scanLogs, ...logs].sort(sortNewestFirst);

  return (
    <details className="group rounded-token border border-line bg-surface-2">
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-ink-dim marker:content-none">
        Activity log
        <span className="ml-1 sv-num">({entries.length})</span>
        <span className="float-right text-ink-dim group-open:hidden">Show</span>
        <span className="float-right hidden text-ink-dim group-open:inline">Hide</span>
      </summary>

      <div className="border-t border-line px-3 py-2">
        {entries.length === 0 ? (
          <p className="text-[12px] text-ink-dim">Nothing recorded yet.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((entry, index) => (
              <li key={`${entry.action}-${entryTime(entry)}-${index}`} className="text-[12px]">
                <p className="text-ink">
                  <span className="font-medium">{entry.action}</span>
                  {entry.message ? <span className="text-ink-dim"> — {entry.message}</span> : null}
                </p>
                <p className="text-ink-dim">
                  {actorName(entry)} · {formatDateTime(entryTime(entry))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

/** Entries carry `dateCreated` on the expanded shape and `createdAt` on others. */
function entryTime(entry: ScanLog): string | undefined {
  return entry.dateCreated ?? entry.createdAt;
}

function sortNewestFirst(a: ScanLog, b: ScanLog): number {
  return (entryTime(b) ?? '').localeCompare(entryTime(a) ?? '');
}

/**
 * `author` is who acted and `user` is who the entry is about. Either can be a
 * bare id string or a partially populated user (the expanded form on these
 * routes has no `id`), so both are handled.
 */
function actorName(entry: ScanLog): string {
  const actor = entry.author ?? entry.user;
  if (!actor) return 'System';
  if (typeof actor === 'string') return 'Unknown user';
  return userDisplayName(actor as UserBasic);
}
