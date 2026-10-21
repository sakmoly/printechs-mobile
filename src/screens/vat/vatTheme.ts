export const VAT = {
  card: "#ffffff",
  border: "#e2e8f0",
  title: "#0f172a",
  subtitle: "#64748b",
  output: "#2563eb",
  input: "#7c3aed",
  net: "#0d9488",
  warning: "#d97706",
  warningBg: "#fffbeb",
  danger: "#dc2626",
  muted: "#94a3b8",
  link: "#667eea",
} as const;

/** Dashboard display — whole SAR (no halalas on tiles/cards). */
export function formatVatAmount(amount: number, currency = "SAR"): string {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })} ${currency}`;
}
