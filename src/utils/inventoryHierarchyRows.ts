export function hierarchyRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.rows)) return p.rows as Record<string, unknown>[];
    if (Array.isArray(p.message)) return p.message as Record<string, unknown>[];
  }
  return [];
}

export function hierarchyRowLabel(row: Record<string, unknown>): string {
  return String(
    row.label ??
      row.name ??
      row.brand ??
      row.item_name ??
      row.item_code ??
      row.warehouse ??
      row.territory ??
      row.id ??
      ""
  ).trim();
}

export function hierarchyRowId(row: Record<string, unknown>): string {
  return String(
    row.id ??
      row.name ??
      row.brand ??
      row.item_code ??
      row.warehouse ??
      hierarchyRowLabel(row)
  ).trim();
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function hierarchyRowQty(row: Record<string, unknown>): number | null {
  return num(
    row.qty ??
      row.actual_qty ??
      row.stock_qty ??
      row.quantity ??
      row.total_qty
  );
}

export function hierarchyRowValue(row: Record<string, unknown>): number | null {
  return num(
    row.value ?? row.stock_value ?? row.amount ?? row.total_value
  );
}
