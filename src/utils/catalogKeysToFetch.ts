import type { DashboardWidgetDataResponse } from "../api/dashboardWidgetData";
import { isEmptyWidgetPayload } from "./widgetPayload";

type CatalogItem = {
  key: string;
  aliases?: string[];
  sort_order?: number;
};

type ResolvePayloadFn<T extends CatalogItem> = (
  widgetMap: Record<string, unknown>,
  item: T,
  consumed: Set<string>
) => { payload: Record<string, unknown>; mapKey: string } | null;

/** Widget is missing when absent from batch OR present but empty (shell only). */
export function catalogKeysToFetchWithContent<T extends CatalogItem>(
  widgetMap: Record<string, unknown>,
  catalog: T[],
  consumed: Set<string>,
  resolveCatalogPayload: ResolvePayloadFn<T>,
  bootstrapKeys?: string[],
  matchesBootstrap?: (item: T, keys?: string[]) => boolean
): string[] {
  const missing: string[] = [];
  for (const item of catalog) {
    if (matchesBootstrap && !matchesBootstrap(item, bootstrapKeys)) continue;
    const hit = resolveCatalogPayload(widgetMap, item, consumed);
    if (hit) {
      const payload = hit.payload as DashboardWidgetDataResponse;
      if (isEmptyWidgetPayload(payload)) {
        missing.push(item.key);
        continue;
      }
      consumed.add(hit.mapKey.toLowerCase());
      consumed.add(item.key.toLowerCase());
      for (const a of item.aliases || []) {
        consumed.add(String(a).toLowerCase());
      }
    } else {
      missing.push(item.key);
    }
  }
  return missing;
}
