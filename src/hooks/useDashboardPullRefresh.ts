import { useCallback, useState } from "react";

const DEFAULT_MIN_VISIBLE_MS = 750;

/**
 * Keeps refresh UI visible long enough for users to see feedback (fast cache hits).
 */
export function useDashboardPullRefresh(
  refreshFn: () => Promise<void>,
  minVisibleMs = DEFAULT_MIN_VISIBLE_MS
) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const started = Date.now();
    try {
      await refreshFn();
    } finally {
      const remain = minVisibleMs - (Date.now() - started);
      if (remain > 0) {
        await new Promise((resolve) => setTimeout(resolve, remain));
      }
      setRefreshing(false);
    }
  }, [refreshFn, minVisibleMs]);

  return { refreshing, onRefresh };
}
