import React, { forwardRef } from "react";
import {
  DashboardFilterBar,
  type CompareMode,
  type DashboardFilterBarHandle,
} from "../dashboard/DashboardFilterBar";
import { INVENTORY } from "../../screens/inventory/inventoryTheme";
import type { PeriodPreset } from "../../utils/period";

export type {
  CompareMode,
  DashboardFilterBarHandle as InventoryFilterBarHandle,
};

type Props = {
  territories?: string[];
  selectedTerritory?: string;
  periodPreset: PeriodPreset;
  compareMode: CompareMode;
  onPeriodChange: (preset: PeriodPreset) => void;
  onCompareChange: (mode: CompareMode) => void;
  onTerritoryChange: (territory: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export const InventoryFilterBar = forwardRef<DashboardFilterBarHandle, Props>(
  function InventoryFilterBar(props, ref) {
    return (
      <DashboardFilterBar
        ref={ref}
        theme={{
          card: INVENTORY.card,
          border: INVENTORY.border,
          title: INVENTORY.title,
          subtitle: INVENTORY.subtitle,
          refreshBtn: INVENTORY.title,
        }}
        {...props}
      />
    );
  }
);
