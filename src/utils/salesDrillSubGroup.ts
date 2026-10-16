/**
 * Full Sub_Group from tabSalesDashBoard drill rows (BA contract).
 * Prefer row.sub_group / drill_filter.sub_group[0] — not short UI labels.
 */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function firstStringFromArray(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return "";
  return String(value[0] ?? "").trim();
}

/** Extract filter sub_group from a raw API row object. */
export function parseRawRowSubGroup(raw: Record<string, unknown>): string {
  const direct = String(
    raw.sub_group ?? raw.subGroup ?? raw.Sub_Group ?? ""
  ).trim();
  if (direct) return direct;

  const fromDrill = firstStringFromArray(
    asRecord(raw.drill_filter)?.sub_group
  );
  if (fromDrill) return fromDrill;

  return String(
    raw.dimension_value ?? raw.dimensionValue ?? raw.item_group ?? raw.itemGroup ?? ""
  ).trim();
}

/** Build row meta fields used for the next drill filter tap. */
export function salesDrillRowMetaFromRaw(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const subGroup = parseRawRowSubGroup(raw);
  const dimensionValue = String(
    raw.dimension_value ?? raw.dimensionValue ?? ""
  ).trim();
  const itemGroup = String(raw.item_group ?? raw.itemGroup ?? "").trim();
  const drillFilter = asRecord(raw.drill_filter);
  if (subGroup) meta.sub_group = subGroup;
  if (itemGroup && itemGroup !== subGroup) meta.item_group = itemGroup;
  if (dimensionValue) meta.dimension_value = dimensionValue;
  if (drillFilter) meta.drill_filter = drillFilter;
  return meta;
}

/** Value to send as filters.sub_group[0] after item-group tap. */
export function drillSubGroupFilterValueFromMeta(
  meta?: Record<string, unknown> | null
): string {
  if (!meta) return "";
  const subGroup = meta.sub_group;
  if (typeof subGroup === "string" && subGroup.trim()) {
    return subGroup.trim();
  }
  const fromDrill = firstStringFromArray(asRecord(meta.drill_filter)?.sub_group);
  if (fromDrill) return fromDrill;
  const dimensionValue = meta.dimension_value;
  if (typeof dimensionValue === "string" && dimensionValue.trim()) {
    return dimensionValue.trim();
  }
  const itemGroup = meta.item_group;
  if (typeof itemGroup === "string" && itemGroup.trim()) {
    return itemGroup.trim();
  }
  return "";
}
