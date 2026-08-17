/**
 * Safe local widget registry — BA sends type keys only, never component paths.
 * Never evaluate server JavaScript.
 */

import type { ComponentType } from "react";
import type { WidgetRenderProps } from "./types";
import {
  BarWidget,
  DonutWidget,
  ExpandableWidget,
  HeaderWidget,
  KpiWidget,
  LineWidget,
  LinkWidget,
  ListWidget,
  MatrixWidget,
  PieWidget,
  RankingWidget,
  TableWidget,
  UnknownWidget,
} from "./widgetComponents";
import { normalizeWidgetType } from "./types";

export const widgetRegistry: Record<
  string,
  ComponentType<WidgetRenderProps>
> = {
  KPI: KpiWidget,
  BAR: BarWidget,
  LINE: LineWidget,
  PIE: PieWidget,
  DONUT: DonutWidget,
  TABLE: TableWidget,
  RANKING: RankingWidget,
  LIST: ListWidget,
  MATRIX: MatrixWidget,
  EXPANDABLE: ExpandableWidget,
  HEADER: HeaderWidget,
  LINK: LinkWidget,
};

export function resolveWidgetComponent(
  type: string | undefined
): ComponentType<WidgetRenderProps> {
  const key = normalizeWidgetType(type);
  const Comp = widgetRegistry[key];
  // Guard against undefined exports (circular init / stale HMR)
  if (Comp) return Comp;
  return UnknownWidget;
}

export function isKnownWidgetType(type: string | undefined): boolean {
  const key = normalizeWidgetType(type);
  return Object.prototype.hasOwnProperty.call(widgetRegistry, key);
}
