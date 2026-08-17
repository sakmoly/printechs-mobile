/**
 * Phase H — Generic analytics types (logical dimensions only).
 */

export type AnalysisMetricKey =
  | "net_sales"
  | "gross_profit"
  | "gp_pct"
  | "qty"
  | "invoice_count"
  | string;

export type AnalysisViewType = "kpi" | "chart" | "ranking" | "table";

export type GenericAnalysisRequest = {
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  /** Logical dimension to group by — never custom_* */
  dimension: string;
  metric?: AnalysisMetricKey;
  /** Logical filter map */
  filters?: Record<string, string | string[] | number | boolean>;
  limit?: number;
};

export type AnalysisRow = {
  id: string;
  label: string;
  value: number;
  previous?: number | null;
  change_pct?: number | null;
  secondary?: number | null;
  meta?: Record<string, unknown>;
};

export type AnalysisKpi = {
  key: string;
  label: string;
  value: number;
  previous?: number | null;
  change_pct?: number | null;
  format?: "currency" | "number" | "percent";
};

export type GenericAnalysisResponse = {
  meta: {
    currency?: string;
    dimension: string;
    metric: string;
    company?: string;
    from_date?: string;
    to_date?: string;
    source?: "generic" | "product_performance" | "dashboard" | "empty";
  };
  kpis: AnalysisKpi[];
  rows: AnalysisRow[];
  /** Preferred default view from BA — app may override */
  views?: AnalysisViewType[];
};
