import type { AnalysisRow } from "../api/genericAnalysisTypes";

function cellsOf(row: AnalysisRow): Record<string, unknown> {
  const meta = row.meta || {};
  const cells = meta.cells;
  return cells && typeof cells === "object"
    ? (cells as Record<string, unknown>)
    : {};
}

function pickString(row: AnalysisRow, keys: string[]): string {
  const extra = row as Record<string, unknown>;
  const meta = row.meta || {};
  const cells = cellsOf(row);
  for (const key of keys) {
    for (const src of [extra, meta, cells]) {
      const v = src[key];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return "";
}

function pickNumber(row: AnalysisRow, keys: string[]): number | null {
  const extra = row as Record<string, unknown>;
  const meta = row.meta || {};
  const cells = cellsOf(row);
  for (const key of keys) {
    for (const src of [extra, meta, cells]) {
      const v = src[key];
      if (v == null || v === "") continue;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function formatOpenSoDate(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(`${iso}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return iso;
  }
  return s;
}

export function salesOrderFromOpenSoRow(row: AnalysisRow): string {
  return pickString(row, [
    "sales_order",
    "so_name",
    "name",
    "id",
    "label",
  ]);
}

export function customerNameFromOpenSoRow(row: AnalysisRow): string {
  const name = pickString(row, [
    "customer_name",
    "customer_title",
    "party_name",
    "customer",
    "secondary_label",
    "subtitle",
    "description",
  ]);
  if (!name) return "";
  const so = salesOrderFromOpenSoRow(row);
  if (so && name.toUpperCase() === so.toUpperCase()) return "";
  if (/^SOD\d/i.test(name) || /^SO[-/]/i.test(name)) return "";
  return name;
}

export function deliveryDateFromOpenSoRow(row: AnalysisRow): string {
  return pickString(row, [
    "delivery_date",
    "expected_delivery_date",
    "schedule_date",
    "reqd_by_date",
    "transaction_date",
  ]);
}

/** Ascending sort key; missing/invalid dates sort last. */
export function openSoDeliverySortMs(
  row: AnalysisRow,
  mode: "order" | "line" = "order"
): number {
  const raw =
    mode === "line"
      ? lineDeliveryDateFromOpenSoRow(row)
      : deliveryDateFromOpenSoRow(row);
  const iso = String(raw || "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const t = new Date(`${iso}T12:00:00`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Number.POSITIVE_INFINITY;
}

export function compareOpenSoOrdersByDeliveryDate(
  a: AnalysisRow,
  b: AnalysisRow
): number {
  const byDate = openSoDeliverySortMs(a, "order") - openSoDeliverySortMs(b, "order");
  if (byDate !== 0) return byDate;
  return salesOrderFromOpenSoRow(a).localeCompare(
    salesOrderFromOpenSoRow(b),
    undefined,
    { sensitivity: "base" }
  );
}

export function compareOpenSoLinesByDeliveryDate(
  a: AnalysisRow,
  b: AnalysisRow
): number {
  const byDate = openSoDeliverySortMs(a, "line") - openSoDeliverySortMs(b, "line");
  if (byDate !== 0) return byDate;
  return itemCodeFromOpenSoLineRow(a).localeCompare(
    itemCodeFromOpenSoLineRow(b),
    undefined,
    { sensitivity: "base" }
  );
}

export function openAmountFromOpenSoRow(row: AnalysisRow): number {
  const n = pickNumber(row, [
    "pending_delivery_value",
    "pending_amount",
    "open_value",
    "outstanding",
    "amount",
    "value",
    "grand_total",
  ]);
  if (n != null) return n;
  return Number.isFinite(row.value) ? row.value : 0;
}

export function itemCodeFromOpenSoLineRow(row: AnalysisRow): string {
  const code = pickString(row, ["item_code", "item", "sku", "code"]);
  if (code) return code;
  const label = String(row.label || "").trim();
  if (label && !looksLikeWarehouse(label)) return label;
  return "";
}

export function itemNameFromOpenSoLineRow(row: AnalysisRow): string {
  const name = pickString(row, [
    "item_name",
    "description",
    "item_description",
    "item_group",
  ]);
  if (name) return name;
  const label = String(row.label || "").trim();
  if (label && looksLikeWarehouse(label)) return "";
  return label;
}

function looksLikeWarehouse(text: string): boolean {
  return /\bWHS\b|\bwarehouse\b|–\s*PRNTX/i.test(text);
}

export function lineDeliveryDateFromOpenSoRow(row: AnalysisRow): string {
  return pickString(row, [
    "delivery_date",
    "schedule_date",
    "expected_delivery_date",
    "reqd_by_date",
  ]);
}

export function linePendingQty(row: AnalysisRow): number | null {
  return pickNumber(row, ["pending_qty", "qty_pending", "balance_qty"]);
}

export function linePendingAmount(row: AnalysisRow): number {
  const direct = pickNumber(row, [
    "pending_amount",
    "pending_value",
    "amount",
    "net_amount",
    "value",
  ]);
  if (direct != null && direct > 0) return direct;
  const qty = linePendingQty(row);
  const rate = pickNumber(row, ["rate", "net_rate", "price"]);
  if (qty != null && rate != null && qty > 0) return qty * rate;
  return direct ?? (Number.isFinite(row.value) ? row.value : 0);
}

export function orderRowSubtitle(row: AnalysisRow): string {
  const customer = customerNameFromOpenSoRow(row);
  const date = formatOpenSoDate(deliveryDateFromOpenSoRow(row));
  if (customer && date) return `${customer} · Del ${date}`;
  if (customer) return customer;
  if (date) return `Del ${date}`;
  return "—";
}

export function lineRowSubtitle(row: AnalysisRow): string {
  const name = itemNameFromOpenSoLineRow(row);
  const date = formatOpenSoDate(lineDeliveryDateFromOpenSoRow(row));
  if (name && date) return `${name} · Del ${date}`;
  if (name) return name;
  if (date) return `Del ${date}`;
  return "";
}
