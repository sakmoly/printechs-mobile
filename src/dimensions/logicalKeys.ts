/**
 * Phase F — Logical dimensions only.
 * The app never sends ERPNext physical field names (custom_*, source_field).
 * BA maps logical keys → site fields server-side.
 */

/** Well-known logical keys (open set — BA may add more) */
export const KNOWN_LOGICAL_DIMENSIONS = [
  "company",
  "territory",
  "warehouse",
  "brand",
  "division",
  "department",
  "cost_center",
  "branch",
  // Fashion / retail (logical — BA maps to custom_* on site)
  "season",
  "year",
  "style",
  "color",
  "size",
  "region",
  "store",
  "category",
  "item_group",
  "sub_group",
  "salesperson",
  "item",
] as const;

export type KnownLogicalDimension = (typeof KNOWN_LOGICAL_DIMENSIONS)[number];

/** Any dimension key from bootstrap — open string */
export type LogicalDimensionKey = string;

export type DimensionDataType =
  | "Link"
  | "Select"
  | "Data"
  | "Date"
  | "Check"
  | "Int"
  | "Float"
  | "Currency"
  | string;

export type ResolvedDimension = {
  key: LogicalDimensionKey;
  label: string;
  data_type: DimensionDataType;
  filterable: boolean;
  groupable: boolean;
  sortable: boolean;
};

/** Default labels for known keys when BA omits label */
export const LOGICAL_DIMENSION_LABELS: Record<string, string> = {
  company: "Company",
  territory: "Territory",
  warehouse: "Warehouse",
  brand: "Brand",
  division: "Division",
  department: "Department",
  cost_center: "Cost Center",
  branch: "Branch",
  season: "Season",
  year: "Year",
  style: "Style",
  color: "Color",
  size: "Size",
  region: "Region",
  store: "Store",
  category: "Category",
  item_group: "Item Group",
  sub_group: "Sub Group",
  salesperson: "Salesperson",
  item: "Item",
};

/**
 * Query/body param names that belong to a logical dimension.
 * Never include custom_* physical names here.
 */
export const LOGICAL_DIMENSION_PARAM_KEYS: Record<string, string[]> = {
  company: ["company"],
  territory: ["territory", "territories"],
  warehouse: ["warehouse"],
  brand: ["brand"],
  division: ["division"],
  department: ["department"],
  cost_center: ["cost_center", "costCenter"],
  branch: ["branch"],
  season: ["season"],
  year: ["year"],
  style: ["style"],
  color: ["color", "colour"],
  size: ["size"],
  region: ["region"],
  store: ["store"],
  category: ["category"],
  item_group: ["item_group", "itemGroup"],
  sub_group: ["sub_group", "subGroup"],
  salesperson: ["salesperson"],
  item: ["item", "item_code"],
};

/** Keys that must never leave the device toward BA as filters */
const FORBIDDEN_PHYSICAL_PARAM =
  /^(custom_|source_field|sourceField|fieldname|doctype_field)/i;

export function isForbiddenPhysicalParam(key: string): boolean {
  return FORBIDDEN_PHYSICAL_PARAM.test(key);
}

export function isPhysicalFieldName(key: string): boolean {
  return /^custom_/i.test(key) || isForbiddenPhysicalParam(key);
}

/**
 * Assert a dimension key is logical (dev warning; does not throw in prod).
 */
export function assertLogicalDimensionKey(key: string): boolean {
  if (isPhysicalFieldName(key)) {
    if (__DEV__) {
      console.warn(
        `[dimensions] Rejected physical ERPNext field "${key}". Use a logical key (e.g. brand, season).`
      );
    }
    return false;
  }
  return true;
}

export function humanizeDimensionKey(key: string): string {
  return (
    LOGICAL_DIMENSION_LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
