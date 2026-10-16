import React, { forwardRef } from "react";
import {
  DashboardFilterBar,
  type CompareMode,
  type DashboardFilterBarHandle,
} from "../dashboard/DashboardFilterBar";
import { HOME } from "../../screens/home/homeTheme";
import type { PeriodPreset } from "../../utils/period";

export type { CompareMode, DashboardFilterBarHandle as HomeFilterBarHandle };

type Props = {
  territories?: string[];
  selectedTerritory?: string;
  periodPreset: PeriodPreset;
  compareMode: CompareMode;
  onPeriodChange: (preset: PeriodPreset) => void;
  onCompareChange: (mode: CompareMode) => void;
  onTerritoryChange: (territory: string) => void;
};

export const HomeFilterBar = forwardRef<DashboardFilterBarHandle, Props>(
  function HomeFilterBar(props, ref) {
    return (
      <DashboardFilterBar
        ref={ref}
        theme={{
          card: HOME.card,
          border: HOME.border,
          title: HOME.title,
          subtitle: HOME.subtitle,
        }}
        {...props}
      />
    );
  }
);
