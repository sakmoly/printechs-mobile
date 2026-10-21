import { useQuery } from "@tanstack/react-query";
import { fetchVatBucketDetail } from "../api/vat";
import {
  getVatDrillBucket,
  getVatDrillQueryParams,
} from "../screens/vat/vatDrillStore";

export function vatBucketDetailQueryKey(bucketKey: string) {
  const ctx = getVatDrillQueryParams();
  return [
    "vat-bucket-detail",
    bucketKey,
    ctx?.company,
    ctx?.period,
    ctx?.from_date,
    ctx?.to_date,
    ctx?.territory,
  ] as const;
}

export function useVatBucketDetail(bucketKey: string) {
  const bucket = bucketKey ? getVatDrillBucket(bucketKey) : undefined;
  const ctx = getVatDrillQueryParams();
  const seedDocs = bucket?.documents ?? [];

  return useQuery({
    queryKey: vatBucketDetailQueryKey(bucketKey),
    queryFn: async () => {
      const rows = await fetchVatBucketDetail({
        ...ctx,
        bucket_key: bucketKey,
      });
      if (rows.length > 0) return rows;
      return seedDocs;
    },
    enabled: Boolean(bucketKey && ctx?.company),
    initialData: seedDocs.length > 0 ? seedDocs : undefined,
    staleTime: 30_000,
  });
}
