import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

export const HOME = {
  bg: "#f5f7fa",
  card: "#ffffff",
  border: "#e8ecf1",
  title: "#1e3a5f",
  subtitle: "#64748b",
  label: "#64748b",
  value: "#0f172a",
  link: "#2563eb",
  accent: "#667eea",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  orange: "#ea580c",
  teal: "#0891b2",
  purple: "#7c3aed",
} as const;

export const TREND_SERIES_COLORS: Record<string, string> = {
  sales: "#2563eb",
  purchases: "#ea580c",
  receivables: "#16a34a",
  payables: "#dc2626",
};

export type KpiVisual = {
  icon: IonIcon;
  iconColor: string;
  iconBg: string;
  increaseIsBad?: boolean;
};

export function resolveKpiVisual(key: string, kpiId?: string | null): KpiVisual {
  const id = String(kpiId || key || "")
    .toLowerCase()
    .replace(/^home_/, "")
    .replace(/_kpi$/, "");

  if (/sales/.test(id) && !/receivable/.test(id)) {
    return { icon: "trending-up", iconColor: "#2563eb", iconBg: "#eff6ff" };
  }
  if (/receivable/.test(id)) {
    return { icon: "wallet-outline", iconColor: "#16a34a", iconBg: "#f0fdf4" };
  }
  if (/inventory/.test(id)) {
    return { icon: "cube-outline", iconColor: "#7c3aed", iconBg: "#f5f3ff" };
  }
  if (/purchase/.test(id)) {
    return { icon: "cart-outline", iconColor: "#ea580c", iconBg: "#fff7ed" };
  }
  if (/payable/.test(id)) {
    return { icon: "wallet-outline", iconColor: "#dc2626", iconBg: "#fef2f2" };
  }
  if (/gross.profit|gp/.test(id)) {
    return { icon: "pie-chart-outline", iconColor: "#0891b2", iconBg: "#ecfeff" };
  }
  if (/margin|gp_margin/.test(id)) {
    return { icon: "analytics-outline", iconColor: "#dc2626", iconBg: "#fef2f2" };
  }
  if (/ratio|current_ratio/.test(id)) {
    return { icon: "pulse-outline", iconColor: "#2563eb", iconBg: "#eff6ff" };
  }
  if (/cash.flow|operating/.test(id)) {
    return { icon: "cash-outline", iconColor: "#16a34a", iconBg: "#f0fdf4" };
  }
  if (/net.profit/.test(id)) {
    return { icon: "stats-chart-outline", iconColor: "#0891b2", iconBg: "#ecfeff" };
  }
  return { icon: "stats-chart-outline", iconColor: "#6366f1", iconBg: "#eef2ff" };
}

export function formatDateRangeLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const a = fmt(from);
  const b = fmt(to);
  if (a === b) return a;
  const aShort = a.replace(/\s\d{4}$/, "");
  return `${aShort} – ${b}`;
}

export function healthStatus(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Good", color: HOME.green };
  if (score >= 60) return { text: "Fair", color: HOME.amber };
  return { text: "Needs Attention", color: HOME.red };
}
