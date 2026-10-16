import React, { forwardRef } from "react";
import {
  DashboardFilterBar,
  type CompareMode,
  type DashboardFilterBarHandle,
} from "../dashboard/DashboardFilterBar";
import { SALES } from "../../screens/sales/salesTheme";
import type { PeriodPreset } from "../../utils/period";

export type { CompareMode, DashboardFilterBarHandle as SalesFilterBarHandle };

type Props = {
  territories?: string[];
  selectedTerritory?: string;
  periodPreset: PeriodPreset;
  compareMode: CompareMode;
  onPeriodChange: (preset: PeriodPreset) => void;
  onCompareChange: (mode: CompareMode) => void;
  onTerritoryChange: (territory: string) => void;
};

export const SalesFilterBar = forwardRef<DashboardFilterBarHandle, Props>(
  function SalesFilterBar(props, ref) {
    return (
      <DashboardFilterBar
        ref={ref}
        theme={{
          card: SALES.card,
          border: SALES.border,
          title: SALES.title,
          subtitle: SALES.subtitle,
        }}
        {...props}
      />
    );
  }
);
