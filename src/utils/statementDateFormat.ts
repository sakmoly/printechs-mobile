import { parseFlexibleIsoDate } from "../api/customerStatement";

/** Statement / SOA display dates (desk-style dd-mm-yyyy). */
export function formatStatementDateDdMmYyyy(raw: unknown): string {
  const iso = parseFlexibleIsoDate(raw);
  if (!iso) {
    const s = String(raw || "").trim();
    return s || "—";
  }
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
