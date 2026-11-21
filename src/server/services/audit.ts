import "server-only";
import { randomUUID } from "node:crypto";
import type { DB } from "../db";
import { getDb, schema } from "../db";

type Snapshot = Record<string, unknown>;

/** Returns only the keys whose values changed, as paired before/after snapshots. */
export function diffSnapshots(before: Snapshot | null, after: Snapshot | null): { before: Snapshot | null; after: Snapshot | null } {
  if (!before || !after) return { before, after };
  const b: Snapshot = {};
  const a: Snapshot = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return { before: b, after: a };
}

export function writeAudit(
  entry: {
    actor: { id: string; email: string } | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: Snapshot | null;
    after?: Snapshot | null;
    reason?: string | null;
  },
  tx: Pick<DB, "insert"> = getDb(),
): void {
  const diff = diffSnapshots(entry.before ?? null, entry.after ?? null);
  if (entry.before && entry.after && Object.keys(diff.after ?? {}).length === 0) return;
  tx.insert(schema.auditLogs)
    .values({
      id: randomUUID(),
      actorId: entry.actor?.id ?? null,
      actorEmail: entry.actor?.email ?? "system",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: diff.before,
      after: diff.after,
      reason: entry.reason ?? null,
    })
    .run();
}
