/** Open amount on one voucher — never use SOA running `balance` here. */
export function parseStatementLineOutstanding(it: unknown): number {
  if (!it || typeof it !== "object") return 0;
  const raw = it as Record<string, unknown>;
  for (const key of [
    "outstanding_amount",
    "base_outstanding_amount",
    "open_amount",
    "remaining_amount",
    "invoice_outstanding",
    "outstanding",
  ]) {
    const n = Number(raw[key]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
