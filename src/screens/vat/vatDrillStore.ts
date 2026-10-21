import type { VatDashboardParams } from "../../api/vat";
import type { VatDrillBucket } from "../../api/vatTypes";

const buckets = new Map<string, VatDrillBucket>();
let lastQueryParams: VatDashboardParams | undefined;

export function registerVatDrillBuckets(
  list: VatDrillBucket[],
  queryParams?: VatDashboardParams
) {
  buckets.clear();
  for (const b of list) {
    buckets.set(b.key, b);
  }
  if (queryParams) {
    lastQueryParams = { ...queryParams };
  }
}

export function getVatDrillBucket(key: string): VatDrillBucket | undefined {
  return buckets.get(key);
}

export function getVatDrillQueryParams(): VatDashboardParams | undefined {
  return lastQueryParams ? { ...lastQueryParams } : undefined;
}
