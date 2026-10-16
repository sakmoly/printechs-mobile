import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IonIcon = ComponentProps<typeof Ionicons>["name"];

export const RECEIVABLES = {
  bg: "#f5f7fa",
  card: "#ffffff",
  border: "#e8ecf1",
  title: "#1e3a5f",
  subtitle: "#64748b",
  label: "#64748b",
  value: "#0f172a",
  link: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
} as const;

export const AGING_COLORS = [
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ea580c",
  "#ef4444",
];

export type KpiVisual = {
  icon: IonIcon;
  iconColor: string;
  iconBg: string;
  increaseIsBad?: boolean;
};

export function resolveKpiVisual(key: string, kpiId?: string | null): KpiVisual {
  const id = String(kpiId || key || "")
    .toLowerCase()
    .replace(/^receivables_/, "")
    .replace(/_kpi$/, "");

  if (/total|total_receivable/.test(id)) {
    return {
      icon: "wallet-outline",
      iconColor: "#2563eb",
      iconBg: "#eff6ff",
    };
  }
  if (/overdue_pct|overdue_percent/.test(id)) {
    return {
      icon: "pie-chart-outline",
      iconColor: "#ca8a04",
      iconBg: "#fefce8",
      increaseIsBad: true,
    };
  }
  if (/overdue/.test(id)) {
    return {
      icon: "alert-circle-outline",
      iconColor: "#ea580c",
      iconBg: "#fff7ed",
      increaseIsBad: true,
    };
  }
  if (/current|not_yet|not_due/.test(id)) {
    return {
      icon: "time-outline",
      iconColor: "#16a34a",
      iconBg: "#f0fdf4",
    };
  }
  if (/customer_advances|advances/.test(id)) {
    return {
      icon: "cash-outline",
      iconColor: "#0d9488",
      iconBg: "#ecfdf5",
    };
  }
  if (/customer|count/.test(id)) {
    return {
      icon: "people-outline",
      iconColor: "#7c3aed",
      iconBg: "#f5f3ff",
    };
  }
  if (/dso|collection_days|avg_collection/.test(id)) {
    return {
      icon: "calendar-outline",
      iconColor: "#0891b2",
      iconBg: "#ecfeff",
      increaseIsBad: true,
    };
  }
  if (/collected_mtd|mtd/.test(id)) {
    return {
      icon: "cash-outline",
      iconColor: "#16a34a",
      iconBg: "#f0fdf4",
    };
  }
  if (/collected_ytd|ytd/.test(id)) {
    return {
      icon: "document-text-outline",
      iconColor: "#2563eb",
      iconBg: "#eff6ff",
    };
  }
  if (/efficiency/.test(id)) {
    return {
      icon: "speedometer-outline",
      iconColor: "#7c3aed",
      iconBg: "#f5f3ff",
    };
  }
  return {
    icon: "stats-chart-outline",
    iconColor: "#6366f1",
    iconBg: "#eef2ff",
  };
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
  return String(title || "")
    .trim()
    .toUpperCase();
}
