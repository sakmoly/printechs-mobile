import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";
import { getVatDrillBucket } from "../../src/screens/vat/vatDrillStore";
import { formatVatAmount, VAT } from "../../src/screens/vat/vatTheme";
import { Fonts } from "../../src/theme/typography";
import { useVatBucketDetail } from "../../src/hooks/useVatBucketDetail";
import type { VatDocumentRow } from "../../src/api/vatTypes";

function partyLabel(doc: VatDocumentRow): string | undefined {
  return (
    doc.party_name ||
    doc.customer_name ||
    doc.customer ||
    doc.supplier_name ||
    doc.supplier
  );
}

function docStatusLabel(docstatus?: number): string | undefined {
  if (docstatus == null) return undefined;
  if (docstatus === 0) return "Draft (not posted)";
  if (docstatus === 1) return "Submitted";
  if (docstatus === 2) return "Cancelled";
  return `Status ${docstatus}`;
}

function VatInvoiceCard({
  doc,
  currency,
  vatAccent,
  showResubmitHint,
}: {
  doc: VatDocumentRow;
  currency: string;
  vatAccent: string;
  showResubmitHint: boolean;
}) {
  const party = partyLabel(doc);
  const zatcaIssue =
    doc.zatca_error ||
    doc.zatca_rejection ||
    (doc.zatca_status &&
    !/cleared|reported/i.test(doc.zatca_status)
      ? doc.zatca_status
      : undefined);

  return (
    <View style={styles.docCard}>
      <View style={styles.docHead}>
        <Text style={styles.docName} numberOfLines={2}>
          {doc.name}
        </Text>
        <Text style={[styles.docVat, { color: vatAccent }]}>
          {formatVatAmount(doc.vat_amount, currency)}
        </Text>
      </View>

      {party ? (
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={14} color={VAT.subtitle} />
          <Text style={styles.metaText} numberOfLines={2}>
            {party}
          </Text>
        </View>
      ) : null}

      {doc.territory ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={VAT.subtitle} />
          <Text style={styles.metaText}>{doc.territory}</Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={VAT.subtitle} />
        <Text style={styles.metaText}>
          {doc.posting_date || "—"}
          {doc.doctype ? ` · ${doc.doctype}` : ""}
        </Text>
      </View>

      {(doc.grand_total != null && doc.grand_total > 0) ||
      (doc.net_total != null && doc.net_total > 0) ? (
        <View style={styles.amountRow}>
          {doc.net_total != null && doc.net_total > 0 ? (
            <Text style={styles.amountChip}>
              Net {formatVatAmount(doc.net_total, currency)}
            </Text>
          ) : null}
          {doc.grand_total != null && doc.grand_total > 0 ? (
            <Text style={styles.amountChip}>
              Total {formatVatAmount(doc.grand_total, currency)}
            </Text>
          ) : null}
          {doc.taxable_amount != null && doc.taxable_amount > 0 ? (
            <Text style={styles.amountChip}>
              Taxable {formatVatAmount(doc.taxable_amount, currency)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {doc.zatca_status ? (
        <Text style={styles.docZatca}>ZATCA: {doc.zatca_status}</Text>
      ) : null}
      {zatcaIssue ? (
        <Text style={styles.docZatcaWarn}>{zatcaIssue}</Text>
      ) : null}
      {docStatusLabel(doc.docstatus) ? (
        <Text style={styles.docMeta}>{docStatusLabel(doc.docstatus)}</Text>
      ) : null}

      {showResubmitHint ? (
        <View style={styles.hintBox}>
          <Ionicons name="alert-circle-outline" size={16} color={VAT.warning} />
          <Text style={styles.hintText}>
            Open this invoice in ERPNext and resubmit to ZATCA (Sales Invoice →
            ZATCA actions).
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function VatDetailScreen() {
  const { topInset, scrollPaddingBottom } = useSafeScreenInsets({
    aboveTabBar: true,
  });
  const params = useLocalSearchParams<{
    bucketKey?: string;
    title?: string;
    currency?: string;
  }>();

  const bucketKey = String(params.bucketKey || "").trim();
  const title = String(params.title || "VAT detail").trim();
  const currency = String(params.currency || "SAR").trim();

  const bucket = useMemo(
    () => (bucketKey ? getVatDrillBucket(bucketKey) : undefined),
    [bucketKey]
  );

  const { data: documents, isLoading, isError, error } = useVatBucketDetail(
    bucketKey
  );

  const vatAccent =
    bucket?.section === "input"
      ? VAT.input
      : bucket?.section === "not_submitted"
        ? VAT.warning
        : VAT.output;

  const showResubmitHint =
    bucketKey.includes("zatca") ||
    bucketKey.includes("not_submitted") ||
    bucket?.section === "not_submitted";

  const list = documents ?? bucket?.documents ?? [];

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.flex}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <ScreenHeaderNav color={VAT.title} buttonBackground="#f1f5f9" />
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        {bucket ? (
          <Text style={styles.headerMeta}>
            {formatVatAmount(bucket.vat_amount, currency)}
            {bucket.count != null ? ` · ${bucket.count} document(s)` : ""}
          </Text>
        ) : null}
        {bucket?.subtitle ? (
          <Text style={styles.headerSub}>{bucket.subtitle}</Text>
        ) : null}
        {showResubmitHint ? (
          <Text style={styles.headerAction}>
            Use customer & territory below to chase ZATCA resubmission.
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: scrollPaddingBottom + 16 },
        ]}
      >
        {isLoading && list.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={VAT.link} />
            <Text style={styles.emptySub}>Loading invoice detail…</Text>
          </View>
        ) : null}

        {!bucket ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Detail not available</Text>
            <Text style={styles.emptySub}>
              Go back and open this card again from the VAT report.
            </Text>
          </View>
        ) : isError && list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not load invoices</Text>
            <Text style={styles.emptySub}>
              {(error as Error)?.message ||
                "Ask BA to return documents for this bucket on get_vat_dashboard."}
            </Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.summaryOnly}>
            <Text style={styles.summaryLabel}>Bucket total</Text>
            <Text style={styles.summaryValue}>
              {formatVatAmount(bucket.vat_amount, currency)}
            </Text>
            <Text style={styles.emptySub}>
              No invoice lines returned yet. Totals reflect server filing logic —
              enable include_documents / bucket drill on erp_analysis.tax.get_vat_dashboard.
            </Text>
          </View>
        ) : (
          list.map((doc) => (
            <VatInvoiceCard
              key={`${doc.id}-${doc.name}`}
              doc={doc}
              currency={currency}
              vatAccent={vatAccent}
              showResubmitHint={showResubmitHint}
            />
          ))
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: VAT.card,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VAT.border,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: VAT.title,
    marginTop: 8,
  },
  headerMeta: {
    fontSize: 15,
    fontWeight: "700",
    color: VAT.net,
    marginTop: 6,
  },
  headerSub: {
    fontSize: 12,
    color: VAT.subtitle,
    marginTop: 6,
  },
  headerAction: {
    fontSize: 12,
    color: VAT.warning,
    marginTop: 8,
    fontWeight: "600",
  },
  body: { padding: 16 },
  loading: { padding: 24, alignItems: "center", gap: 10 },
  empty: { padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: VAT.title },
  emptySub: {
    fontSize: 13,
    color: VAT.subtitle,
    textAlign: "center",
    marginTop: 8,
  },
  summaryOnly: {
    backgroundColor: VAT.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
  },
  summaryLabel: { fontSize: 13, color: VAT.subtitle },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: VAT.title,
    marginVertical: 8,
  },
  docCard: {
    backgroundColor: VAT.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VAT.border,
  },
  docHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  docName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: VAT.title,
  },
  docVat: {
    fontSize: 15,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: VAT.subtitle,
  },
  amountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  amountChip: {
    fontSize: 11,
    fontWeight: "600",
    color: VAT.title,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  docMeta: { fontSize: 12, color: VAT.muted, marginTop: 6 },
  docZatca: {
    fontSize: 12,
    color: VAT.subtitle,
    marginTop: 8,
    fontWeight: "600",
  },
  docZatcaWarn: {
    fontSize: 12,
    color: VAT.warning,
    marginTop: 4,
    fontWeight: "600",
  },
  hintBox: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },
});
