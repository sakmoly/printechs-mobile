import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

export const SALES = {
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
} as const;

export type KpiVisual = {
  icon: IonIcon;
  iconColor: string;
  iconBg: string;
  increaseIsBad?: boolean;
};

export function resolveKpiVisual(key: string, kpiId?: string | null): KpiVisual {
  const id = String(kpiId || key || "")
    .toLowerCase()
    .replace(/^sales_/, "")
    .replace(/_kpi$/, "");

  if (/net|total_sales|sales_total/.test(id)) {
    return { icon: "trending-up", iconColor: "#2563eb", iconBg: "#eff6ff" };
  }
  if (/order|invoice/.test(id)) {
    return { icon: "cart-outline", iconColor: "#16a34a", iconBg: "#f0fdf4" };
  }
  if (/margin|pct/.test(id)) {
    return { icon: "pie-chart-outline", iconColor: "#7c3aed", iconBg: "#f5f3ff" };
  }
  if (/profit|gp/.test(id)) {
    return { icon: "wallet-outline", iconColor: "#ea580c", iconBg: "#fff7ed" };
  }
  if (/customer|active/.test(id)) {
    return { icon: "people-outline", iconColor: "#0891b2", iconBg: "#ecfeff" };
  }
  if (/return/.test(id)) {
    return {
      icon: "return-down-back-outline",
      iconColor: "#dc2626",
      iconBg: "#fef2f2",
      increaseIsBad: true,
    };
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

export function sectionTitleUpper(title: string): string {
  return String(title || "").trim().toUpperCase();
}

export function initialsFromLabel(label: string): string {
  const parts = String(label || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
