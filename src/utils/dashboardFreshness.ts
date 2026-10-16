/**
 * Human-readable dashboard cache / refresh timestamps.
 */

export function formatRelativeUpdatedAt(timestampMs: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - timestampMs);
  const sec = Math.floor(delta / 1000);
  if (sec < 45) return "Updated just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Updated ${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `Updated ${day} day${day === 1 ? "" : "s"} ago`;
}

export function resolveLatestTimestamp(
  ...timestamps: Array<number | null | undefined>
): number | null {
  let max = 0;
  for (const t of timestamps) {
    if (t != null && Number.isFinite(t) && t > max) {
      max = t;
    }
  }
  return max > 0 ? max : null;
}

export function formatDashboardFreshnessLabel(opts: {
  updatedAt: number | null;
  isFetching?: boolean;
  offline?: boolean;
  nowMs?: number;
}): string | null {
  const { updatedAt, isFetching, offline, nowMs } = opts;
  if (!updatedAt && !isFetching && !offline) return null;
  const relative = updatedAt
    ? formatRelativeUpdatedAt(updatedAt, nowMs)
    : null;
  if (offline && relative) return `Offline · ${relative}`;
  if (offline && isFetching) return "Offline · Updating…";
  if (offline) return "Offline · showing saved data";
  if (isFetching && relative) return `Updating… · ${relative}`;
  if (isFetching) return "Updating…";
  return relative;
}
