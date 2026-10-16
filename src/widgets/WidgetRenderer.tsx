/**
 * Renders a single bootstrap widget via the local registry.
 * Type comes from drill_views / render_hint / payload shape — never hardcode by widget key.
 */

import React from "react";
import type { MobileWidgetConfig } from "../types/bootstrap";
import { resolveWidgetComponent } from "./registry";
import { resolveEffectiveWidgetType } from "./resolveRenderType";
import type { WidgetData, WidgetDrillPoint } from "./types";
import { normalizeWidgetType } from "./types";

type Props = {
  widget: MobileWidgetConfig;
  data: WidgetData;
  onOpenAnalysis?: (dimension: string, metric?: string) => void;
  onSliceTap?: (point: WidgetDrillPoint) => void;
  drillable?: boolean;
  drillStack?: { dimension: string; label: string; value: string }[];
  onDrillBack?: () => void;
  compact?: boolean;
  hideTitle?: boolean;
};

export function WidgetRenderer({
  widget,
  data,
  onOpenAnalysis,
  onSliceTap,
  drillable,
  drillStack,
  onDrillBack,
  compact,
  hideTitle,
}: Props) {
  const mergedConfig: Record<string, unknown> = {
    ...(widget.config || {}),
    ...(data.config || {}),
    ...(data.action ? { action: data.action } : {}),
  };

  const drillDepth =
    data.drill_depth != null
      ? Number(data.drill_depth)
      : drillStack?.length ?? 0;

  const effectiveType = resolveEffectiveWidgetType({
    bootstrapType: widget.type,
    payloadType: data.widget_type,
    renderHint: data.render_hint,
    drillViews: mergedConfig.drill_views ?? mergedConfig.drillViews,
    drillDepth,
    hasTable: Boolean(data.table?.rows?.length),
    hasChart: Boolean(
      data.chart?.series?.length ||
        (data.rows?.length && !data.table?.rows?.length)
    ),
    hasKpi: Boolean(data.kpis?.length),
    hasAction: Boolean(data.action),
  });

  const Component = resolveWidgetComponent(effectiveType);
  const label =
    (widget.label && widget.label.trim()) ||
    (/^widget_\d+/i.test(widget.key) ? "" : widget.key);

  return (
    <Component
      widgetKey={widget.key}
      label={label}
      type={normalizeWidgetType(effectiveType)}
      metricKey={widget.metric_key}
      dimensionKey={widget.dimension_key}
      secondaryDimensionKey={widget.secondary_dimension_key}
      config={mergedConfig}
      data={data}
      onOpenAnalysis={onOpenAnalysis}
      onSliceTap={onSliceTap}
      drillable={drillable}
      drillStack={drillStack}
      onDrillBack={onDrillBack}
      compact={compact}
      hideTitle={hideTitle}
    />
  );
}
