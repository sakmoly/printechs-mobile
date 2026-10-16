import React, { forwardRef } from "react";
import {
  DashboardFilterBar,
  type CompareMode,
  type DashboardFilterBarHandle,
} from "../dashboard/DashboardFilterBar";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import type { PeriodPreset } from "../../utils/period";

export type {
  CompareMode,
  DashboardFilterBarHandle as ReceivablesFilterBarHandle,
};

type Props = {
  territories?: string[];
  selectedTerritory?: string;
  periodPreset: PeriodPreset;
  compareMode: CompareMode;
  onPeriodChange: (preset: PeriodPreset) => void;
  onCompareChange: (mode: CompareMode) => void;
  onTerritoryChange: (territory: string) => void;
};

export const ReceivablesFilterBar = forwardRef<DashboardFilterBarHandle, Props>(
  function ReceivablesFilterBar(props, ref) {
    return (
      <DashboardFilterBar
        ref={ref}
        theme={{
          card: RECEIVABLES.card,
          border: RECEIVABLES.border,
          title: RECEIVABLES.title,
          subtitle: RECEIVABLES.subtitle,
        }}
        {...props}
      />
    );
  }
);
