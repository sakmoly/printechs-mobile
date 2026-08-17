import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ExecutiveKpiTile } from "./ExecutiveKpiTile";
import type { ExecutiveDashboard } from "../api/executiveTypes";
import { navigateToModule } from "../modules/navigateToModule";

type Props = {
  data: ExecutiveDashboard;
  canReceivables?: boolean;
  canCollection?: boolean;
  canInventory?: boolean;
  canApprovals?: boolean;
  canPayables?: boolean;
  canPurchase?: boolean;
  canOrders?: boolean;
  canProfitability?: boolean;
  labels?: Partial<
    Record<
      | "receivables"
      | "collection"
      | "inventory"
      | "approvals"
      | "payables"
      | "purchase"
      | "sales_orders"
      | "profitability",
      string
    >
  >;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

export function ExecutiveDashboardSections({
  data,
  canReceivables = true,
  canCollection,
  canInventory = true,
  canApprovals = true,
  canPayables = false,
  canPurchase = false,
  canOrders = false,
  canProfitability = false,
  labels = {},
}: Props) {
  const currency = data.meta.currency || "SAR";
  const gp = data.gross_profit;
  const col = data.collection;
  const ar = data.receivables;
  const inv = data.inventory;
  const ord = data.orders;
  const pur = data.purchasing;
  const ap = data.payables;
  const appr = data.approvals;
  const showCollection = canCollection ?? canReceivables;
  const showProfitability = canProfitability;

  return (
    <View>
      {data.meta.company ? (
        <Text style={styles.companyLine}>
          {data.meta.company}
          {data.meta.currency ? ` · ${data.meta.currency}` : ""}
        </Text>
      ) : null}

      {showProfitability && gp && (
        <Section title={labels.profitability || "Gross Profit"}>
          {gp.mtd && (
            <ExecutiveKpiTile
              title="GP MTD"
              value={gp.mtd.value}
              changePct={gp.mtd.change_pct}
              currency={currency}
              onPress={() => navigateToModule("profitability")}
            />
          )}
          {gp.ytd && (
            <ExecutiveKpiTile
              title="GP YTD"
              value={gp.ytd.value}
              changePct={gp.ytd.change_pct}
              currency={currency}
              onPress={() => navigateToModule("profitability")}
            />
          )}
          {gp.gp_pct && (
            <ExecutiveKpiTile
              title="GP %"
              value={gp.gp_pct.value}
              previous={gp.gp_pct.previous}
              changePct={gp.gp_pct.change_pct}
              format="percent"
              onPress={() => navigateToModule("profitability")}
            />
          )}
        </Section>
      )}

      {showCollection && col && (
        <Section title={labels.collection || "Collection"}>
          {col.today && (
            <ExecutiveKpiTile
              title="Collection Today"
              value={col.today.value}
              currency={currency}
              onPress={() => navigateToModule("collection")}
            />
          )}
          {col.mtd && (
            <ExecutiveKpiTile
              title="Collection MTD"
              value={col.mtd.value}
              currency={currency}
              onPress={() => navigateToModule("collection")}
            />
          )}
          {col.ytd && (
            <ExecutiveKpiTile
              title="Collection YTD"
              value={col.ytd.value}
              currency={currency}
              onPress={() => navigateToModule("collection")}
            />
          )}
        </Section>
      )}

      {canReceivables && ar && (
        <Section title={labels.receivables || "Receivables"}>
          <ExecutiveKpiTile
            title="Total Receivable"
            value={ar.total}
            currency={currency}
            onPress={() => navigateToModule("receivables")}
          />
          <ExecutiveKpiTile
            title="Overdue"
            value={ar.overdue}
            currency={currency}
            subtitle={
              ar.overdue_pct != null
                ? `${Number(ar.overdue_pct).toFixed(1)}% of total`
                : undefined
            }
            onPress={() => navigateToModule("receivables")}
          />
        </Section>
      )}

      {canInventory && inv && (
        <Section title={labels.inventory || "Inventory"}>
          <ExecutiveKpiTile
            title="Inventory Value"
            value={inv.value}
            currency={currency}
            onPress={() => navigateToModule("inventory")}
          />
          <ExecutiveKpiTile
            title="Low Stock"
            value={inv.low_stock_count}
            format="number"
            onPress={() => navigateToModule("inventory")}
          />
          {inv.non_moving_value != null && (
            <ExecutiveKpiTile
              title="Non-Moving Value"
              value={inv.non_moving_value}
              currency={currency}
              onPress={() => navigateToModule("inventory")}
            />
          )}
        </Section>
      )}

      {canOrders && ord && (
        <Section title={labels.sales_orders || "Sales Orders"}>
          <ExecutiveKpiTile
            title="Open SO Value"
            value={ord.open_so_value}
            currency={currency}
            onPress={() => navigateToModule("sales_orders")}
          />
          <ExecutiveKpiTile
            title="Pending Delivery"
            value={ord.pending_delivery_value}
            currency={currency}
            onPress={() => navigateToModule("sales_orders")}
          />
        </Section>
      )}

      {canPurchase && pur && (
        <Section title={labels.purchase || "Purchasing"}>
          <ExecutiveKpiTile
            title="Open PO Value"
            value={pur.open_po_value}
            currency={currency}
            onPress={() => navigateToModule("purchase")}
          />
          <ExecutiveKpiTile
            title="Pending Receipt"
            value={pur.pending_receipt_value}
            currency={currency}
            onPress={() => navigateToModule("purchase")}
          />
        </Section>
      )}

      {canPayables && ap && (
        <Section title={labels.payables || "Payables"}>
          <ExecutiveKpiTile
            title="Total Payable"
            value={ap.total}
            currency={currency}
            onPress={() => navigateToModule("payables")}
          />
          <ExecutiveKpiTile
            title="Overdue Payable"
            value={ap.overdue}
            currency={currency}
            onPress={() => navigateToModule("payables")}
          />
        </Section>
      )}

      {canApprovals && appr && appr.pending_count != null && (
        <Section title={labels.approvals || "Approvals"}>
          <ExecutiveKpiTile
            title="Pending Approvals"
            value={appr.pending_count}
            format="number"
            subtitle={
              appr.pending_count
                ? `${appr.pending_count} awaiting action`
                : "All clear"
            }
            onPress={() => navigateToModule("approvals")}
          />
        </Section>
      )}

      {data.meta.from_date && data.meta.to_date ? (
        <Text style={styles.rangeHint}>
          Range {data.meta.from_date} → {data.meta.to_date}
          {data.meta.currency ? ` · ${data.meta.currency}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  companyLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rangeHint: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
});
