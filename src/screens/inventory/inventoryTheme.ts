import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

export const INVENTORY = {
  bg: "#f5f7fa",
  card: "#ffffff",
  border: "#e8ecf1",
  title: "#1e3a5f",
  subtitle: "#64748b",
  label: "#64748b",
  value: "#0f172a",
  link: "#10b981",
  accent: "#10b981",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  purple: "#7c3aed",
} as const;

export const MOVEMENT_COLORS = [
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#dc2626",
] as const;

export const AGING_COLORS = [
  "#2563eb",
  "#16a34a",
  "#84cc16",
  "#f59e0b",
  "#f97316",
  "#dc2626",
] as const;

export type KpiVisual = {
  icon: IonIcon;
  iconColor: string;
  iconBg: string;
  increaseIsBad?: boolean;
};

export function resolveKpiVisual(key: string, kpiId?: string | null): KpiVisual {
  const id = String(kpiId || key || "")
    .toLowerCase()
    .replace(/^inventory_/, "")
    .replace(/_kpi$/, "");

  if (/total.*value|inventory_value|stock_value/.test(id)) {
    return { icon: "cube-outline", iconColor: "#7c3aed", iconBg: "#f5f3ff" };
  }
  if (/quantity|qty|stock_qty/.test(id)) {
    return { icon: "layers-outline", iconColor: "#2563eb", iconBg: "#eff6ff" };
  }
  if (/available/.test(id)) {
    return { icon: "checkmark-circle-outline", iconColor: "#16a34a", iconBg: "#f0fdf4" };
  }
  if (/reserved/.test(id)) {
    return { icon: "lock-closed-outline", iconColor: "#ea580c", iconBg: "#fff7ed" };
  }
  if (/turnover/.test(id)) {
    return { icon: "sync-outline", iconColor: "#7c3aed", iconBg: "#f5f3ff" };
  }
  if (/days|doi|cover/.test(id)) {
    return {
      icon: "calendar-outline",
      iconColor: "#db2777",
      iconBg: "#fdf2f8",
      increaseIsBad: true,
    };
  }
  if (/low_stock|out_of_stock/.test(id)) {
    return {
      icon: "alert-circle-outline",
      iconColor: "#dc2626",
      iconBg: "#fef2f2",
      increaseIsBad: true,
    };
  }
  return { icon: "stats-chart-outline", iconColor: "#10b981", iconBg: "#ecfdf5" };
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
