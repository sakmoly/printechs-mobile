import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeScreen,
  useSafeScreenInsets,
} from "../../src/components/SafeScreen";
import { ScreenHeaderNav } from "../../src/components/ScreenHeaderNav";
import { optimizedApis } from "../../src/api/optimized-apis";
import { formatCurrency } from "../../src/utils/currency";
import { INVENTORY } from "../../src/screens/inventory/inventoryTheme";
import { Fonts } from "../../src/theme/typography";
import {
  ALL_TERRITORIES,
  territoryLabel,
} from "../../src/utils/dashboardTerritory";
import {
  hierarchyRowId,
  hierarchyRowLabel,
  hierarchyRows,
} from "../../src/utils/inventoryHierarchyRows";
import {
  fetchBrandItemCatalog,
  fetchBrandListForScope,
  fetchItemStockForBrand,
  fetchWarehouseNamesForScope,
} from "../../src/utils/inventoryItemStock";
import {
  computeDaysOfSupply,
  fetchItemSalesQtyTrailingYear,
  formatDaysOfSupply,
} from "../../src/utils/inventoryDaysOfSupply";

const COL_QTY = 54;
const COL_VAL = 78;
const COL_CHEV = 20;

type BrandRow = {
  id: string;
  label: string;
  value: number;
  qty: number;
};

type WhStock = {
  territory: string;
  warehouse: string;
  qty: number;
  value: number;
};

type ItemRow = {
  id: string;
  label: string;
  code: string;
  value: number;
  qty: number;
  byWarehouse: WhStock[];
};

function lineMatchesTerritory(
  lineTerritory: string,
  filter: string | null
): boolean {
  if (!filter) return true;
  const a = String(lineTerritory || "").trim().toLowerCase();
  const b = filter.trim().toLowerCase();
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

/** Short label for warehouse filter chips (long ERP names). */
function shortWarehouseLabel(full: string): string {
  const s = String(full || "").trim();
  if (!s) return "WH";
  const parts = s.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0];
    if (head.length <= 20) return head;
  }
  if (s.length <= 18) return s;
  return `${s.slice(0, 16)}…`;
}

function TableHeader({
  nameCol,
  showChevron,
}: {
  nameCol: string;
  showChevron: boolean;
}) {
  return (
    <View style={styles.tableHead}>
      <Text style={[styles.th, styles.thName]} numberOfLines={1}>
        {nameCol}
      </Text>
      <Text style={[styles.th, styles.thQty]}>Qty</Text>
      <Text style={[styles.th, styles.thVal]}>Value</Text>
      {showChevron ? <View style={styles.thChev} /> : null}
    </View>
  );
}

function FilterChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterRowLabel} numberOfLines={1}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRowScroll}
        contentContainerStyle={styles.filterRowScrollContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function InventoryStockByBrandScreen() {
  const { topInset, scrollPaddingBottom } = useSafeScreenInsets({
    aboveTabBar: true,
  });
  const params = useLocalSearchParams<{
    company?: string;
    territory?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    item_code?: string;
  }>();

  const company = String(params.company || "").trim() || undefined;
  const territoryParam = String(params.territory || "").trim() || undefined;
  const initialTerritory = useMemo(() => {
    const p = String(territoryParam || "").trim();
    if (!p || p === ALL_TERRITORIES) return null;
    return p;
  }, [territoryParam]);

  const [territoryOptions, setTerritoryOptions] = useState<string[]>([]);
  const [activeTerritory, setActiveTerritory] = useState<string | null>(
    initialTerritory
  );
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [whDrillLoading, setWhDrillLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const findItemCode = String(params.item_code || "").trim();
  const [itemFilter, setItemFilter] = useState(findItemCode);
  const [salesQty12m, setSalesQty12m] = useState<number | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  const territorySubtitle = useMemo(() => {
    if (!activeTerritory) return "All territories";
    return territoryLabel(activeTerritory, []);
  }, [activeTerritory]);

  const ensureTerritories = useCallback(async (): Promise<string[]> => {
    if (territoryOptions.length) return territoryOptions;
    const payload = await optimizedApis.getInventoryHierarchy({
      company,
      level: "territory",
      limit: 100,
    });
    const list = hierarchyRows(payload)
      .map((r) => hierarchyRowLabel(r) || hierarchyRowId(r))
      .filter(Boolean);
    setTerritoryOptions(list);
    return list;
  }, [company, territoryOptions.length]);

  const loadBrands = useCallback(
    async (whFilter?: string | null) => {
      const activeWh = whFilter !== undefined ? whFilter : warehouse;
      try {
        const { brands: merged, warehouses: whList } =
          await fetchBrandListForScope(
            company,
            { activeTerritory, warehouse: activeWh },
            14
          );
        setBrands(merged);
        if (whList.length) {
          setWarehouses(whList);
          if (whList.length === 1 && activeWh == null) {
            setWarehouse(whList[0]);
          }
        } else if (!activeWh) {
          void fetchWarehouseNamesForScope(company, activeTerritory)
            .then((names) => {
              if (names.length) setWarehouses(names);
            })
            .catch(() => {});
        }
        if (!merged.length) {
          setError("No brand stock found for this scope.");
        } else {
          setError(null);
        }
      } catch (e) {
        setBrands([]);
        setError(
          e instanceof Error ? e.message : "Failed to load brand list"
        );
      }
      void ensureTerritories();
    },
    [company, activeTerritory, warehouse, ensureTerritories]
  );

  const loadItemsForBrand = useCallback(
    async (brand: BrandRow) => {
      setDrillLoading(true);
      setError(null);
      const brandKey = brand.id || brand.label;
      try {
        const catalog = await fetchBrandItemCatalog(
          brandKey,
          company,
          { activeTerritory, warehouse },
          8
        );
        setItems(
          catalog.map((row) => ({
            ...row,
            byWarehouse: [],
          }))
        );
        if (!catalog.length) {
          setError("No items for this brand in the current scope.");
        }
      } catch (e) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Failed to load items");
      } finally {
        setDrillLoading(false);
      }
    },
    [company, activeTerritory, warehouse]
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setSelectedBrand(null);
        setSelectedItem(null);
        setItems([]);
        await loadBrands();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load brands");
        setBrands([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadBrands]
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  React.useEffect(() => {
    setItemFilter(findItemCode);
  }, [findItemCode]);

  React.useEffect(() => {
    setSelectedItem(null);
    if (selectedBrand) {
      void loadItemsForBrand(selectedBrand);
    }
  }, [selectedBrand, loadItemsForBrand]);

  const refreshItemSales = useCallback(
    async (code: string, brandKey?: string) => {
      setSalesLoading(true);
      try {
        const qty = await fetchItemSalesQtyTrailingYear(code, {
          company,
          territory: activeTerritory,
          brand: brandKey,
        });
        setSalesQty12m(qty);
      } catch {
        setSalesQty12m(null);
      } finally {
        setSalesLoading(false);
      }
    },
    [company, activeTerritory]
  );

  const loadItemWarehouseDetail = useCallback(
    async (item: ItemRow) => {
      const code = String(item.code || "").trim();
      const brandKey = selectedBrand?.id || selectedBrand?.label;
      setSelectedItem({ ...item, byWarehouse: [] });
      setSalesQty12m(null);
      if (!code) return;

      setWhDrillLoading(true);
      try {
        const data = await fetchItemStockForBrand(
          code,
          brandKey || "",
          company,
          12,
          { territory: activeTerritory }
        );
        if (!data?.lines.length) return;

        setSelectedItem({
          ...item,
          label: data.itemName || item.label,
          qty: data.totalQty,
          value: data.totalValue,
          byWarehouse: data.lines
            .map((line) => ({
              territory: line.territory,
              warehouse: line.warehouse,
              qty: line.qty,
              value: line.value,
            }))
            .sort((a, b) => b.qty - a.qty || b.value - a.value),
        });
        void refreshItemSales(code, brandKey);
      } catch {
        /* keep list-scoped item */
      } finally {
        setWhDrillLoading(false);
      }
    },
    [company, selectedBrand, refreshItemSales, activeTerritory]
  );

  React.useEffect(() => {
    if (!selectedItem?.code || !selectedItem.byWarehouse.length) return;
    const brandKey = selectedBrand?.id || selectedBrand?.label;
    void refreshItemSales(selectedItem.code, brandKey);
  }, [activeTerritory]);

  const onBack = () => {
    if (selectedItem) {
      setSelectedItem(null);
      setSalesQty12m(null);
      return;
    }
    if (selectedBrand) {
      setSelectedBrand(null);
      setItems([]);
    }
  };

  const warehouseLines = useMemo(() => {
    if (!selectedItem?.byWarehouse?.length) return [];
    return [...selectedItem.byWarehouse].sort(
      (a, b) => b.qty - a.qty || b.value - a.value
    );
  }, [selectedItem]);

  const filteredWarehouseLines = useMemo(() => {
    return warehouseLines.filter((line) => {
      if (!lineMatchesTerritory(line.territory, activeTerritory)) return false;
      if (warehouse && line.warehouse !== warehouse) return false;
      return true;
    });
  }, [warehouseLines, activeTerritory, warehouse]);

  const displayStockQty = useMemo(() => {
    if (filteredWarehouseLines.length) {
      return filteredWarehouseLines.reduce((s, l) => s + l.qty, 0);
    }
    return selectedItem?.qty ?? 0;
  }, [filteredWarehouseLines, selectedItem?.qty]);

  const displayStockValue = useMemo(() => {
    if (filteredWarehouseLines.length) {
      return filteredWarehouseLines.reduce((s, l) => s + l.value, 0);
    }
    return selectedItem?.value ?? 0;
  }, [filteredWarehouseLines, selectedItem?.value]);

  const daysOfSupply = useMemo(
    () => computeDaysOfSupply(displayStockQty, salesQty12m),
    [displayStockQty, salesQty12m]
  );

  const sectionTitle = selectedItem
    ? selectedItem.code || selectedItem.label
    : selectedBrand
      ? selectedBrand.label
      : "Brands";
  const filteredItems = useMemo(() => {
    const q = itemFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.label.toLowerCase().includes(q)
    );
  }, [items, itemFilter]);

  const sectionCount = selectedItem
    ? filteredWarehouseLines.length
    : selectedBrand
      ? filteredItems.length
      : brands.length;

  const headerSubtitle = selectedItem
    ? `${territorySubtitle}${warehouse ? ` · ${shortWarehouseLabel(warehouse)}` : ""} · By warehouse`
    : selectedBrand
      ? "Tap item for stock by warehouse"
      : territoryOptions.length > 1
        ? "Tap a brand"
        : `${territorySubtitle} · Tap brand for items`;

  return (
    <SafeScreen aboveTabBar includeTop={false} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <ScreenHeaderNav
          color={INVENTORY.title}
          buttonBackground="rgba(15, 23, 42, 0.06)"
          onBack={selectedBrand || selectedItem ? onBack : undefined}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            {findItemCode && !selectedBrand ? "Find item stock" : "Stock by Brand"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !brands.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={INVENTORY.link} />
        </View>
      ) : null}

      {error && !selectedBrand && !brands.length ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading || brands.length || selectedBrand || selectedItem ? (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: scrollPaddingBottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={INVENTORY.link}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {(!selectedBrand || selectedItem) &&
          (territoryOptions.length > 1 || warehouses.length > 1) ? (
            <View style={styles.filtersPanel}>
              {territoryOptions.length > 1 ? (
                <FilterChipRow label="Territory">
                  <TouchableOpacity
                    style={[styles.chip, !activeTerritory && styles.chipActive]}
                    onPress={() => {
                      setActiveTerritory(null);
                      if (selectedItem) {
                        setWarehouse(null);
                        return;
                      }
                      setWarehouse(null);
                      setSelectedBrand(null);
                      setSelectedItem(null);
                      setItems([]);
                      void loadBrands(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !activeTerritory && styles.chipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {territoryOptions.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.chip,
                        activeTerritory === t && styles.chipActive,
                      ]}
                      onPress={() => {
                        setActiveTerritory(t);
                        if (selectedItem) {
                          setWarehouse(null);
                          return;
                        }
                        setWarehouse(null);
                        setSelectedBrand(null);
                        setSelectedItem(null);
                        setItems([]);
                        void loadBrands(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          activeTerritory === t && styles.chipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {territoryLabel(t, [])}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </FilterChipRow>
              ) : null}
              {warehouses.length > 1 ? (
                <FilterChipRow label="Warehouse">
                  <TouchableOpacity
                    style={[styles.chip, !warehouse && styles.chipActive]}
                    onPress={() => {
                      setWarehouse(null);
                      if (selectedItem) return;
                      setSelectedBrand(null);
                      setSelectedItem(null);
                      setItems([]);
                      void loadBrands(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !warehouse && styles.chipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {warehouses.map((wh) => (
                    <TouchableOpacity
                      key={wh}
                      style={[
                        styles.chip,
                        warehouse === wh && styles.chipActive,
                      ]}
                      onPress={() => {
                        setWarehouse(wh);
                        if (selectedItem) return;
                        setSelectedBrand(null);
                        setSelectedItem(null);
                        setItems([]);
                        void loadBrands(wh);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          warehouse === wh && styles.chipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {shortWarehouseLabel(wh)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </FilterChipRow>
              ) : null}
            </View>
          ) : null}

          {findItemCode && !selectedBrand && !selectedItem ? (
            <View style={styles.findBanner}>
              <Text style={styles.findBannerTitle} numberOfLines={1}>
                Find {findItemCode} — pick brand, then item
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{sectionTitle.toUpperCase()}</Text>
              {sectionCount > 0 ? (
                <Text style={styles.cardCount}>{sectionCount}</Text>
              ) : null}
            </View>

            {selectedItem ? (
              <>
                <Text style={styles.itemHeroName} numberOfLines={2}>
                  {selectedItem.label}
                </Text>
                <View style={styles.itemHeroTotals}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Qty</Text>
                    <Text style={styles.heroStatValue}>
                      {whDrillLoading
                        ? "…"
                        : displayStockQty.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                    </Text>
                  </View>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Value</Text>
                    <Text style={styles.heroStatValue}>
                      {whDrillLoading
                        ? "…"
                        : formatCurrency(displayStockValue, "SAR", {
                            compact: true,
                            hideCode: true,
                          })}
                    </Text>
                  </View>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Days sup.</Text>
                    <Text style={[styles.heroStatValue, styles.heroStatDoi]}>
                      {whDrillLoading || salesLoading
                        ? "…"
                        : formatDaysOfSupply(daysOfSupply)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.doiSub} numberOfLines={2}>
                  {salesQty12m != null && salesQty12m > 0
                    ? `12 mo sales: ${salesQty12m.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })} pcs${
                        activeTerritory
                          ? ` · ${territoryLabel(activeTerritory, [])}`
                          : ""
                      }`
                    : "12 mo sales unavailable"}
                </Text>
                <TableHeader
                  nameCol="Territory · Warehouse"
                  showChevron={false}
                />
                {whDrillLoading ? (
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator size="small" color={INVENTORY.link} />
                    <Text style={styles.loadingHint}>Loading warehouses…</Text>
                  </View>
                ) : null}
                {!whDrillLoading && !warehouseLines.length ? (
                  <Text style={styles.empty}>No warehouse stock for this item.</Text>
                ) : null}
                {!whDrillLoading &&
                  filteredWarehouseLines.map((line, i) => (
                  <View
                    key={`${line.territory}-${line.warehouse}-${i}`}
                    style={[
                      styles.dataRow,
                      i === filteredWarehouseLines.length - 1 &&
                        styles.dataRowLast,
                    ]}
                  >
                    <View style={styles.nameCellWrap}>
                      <Text style={styles.whTerritory} numberOfLines={1}>
                        {territoryLabel(line.territory, [])}
                      </Text>
                      <Text style={styles.whName} numberOfLines={2}>
                        {shortWarehouseLabel(line.warehouse)}
                      </Text>
                      {line.warehouse.length > 20 ? (
                        <Text style={styles.whFullName} numberOfLines={2}>
                          {line.warehouse}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.qtyCell}>
                      {line.qty.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                    <Text style={styles.valueCell}>
                      {formatCurrency(line.value, "SAR", {
                        compact: true,
                        hideCode: true,
                      })}
                    </Text>
                  </View>
                ))}
              </>
            ) : !selectedBrand ? (
              <>
                <TableHeader nameCol="Brand" showChevron />
                {!brands.length && !loading ? (
                  <Text style={styles.empty}>No brands to show.</Text>
                ) : null}
                {brands.map((row, i) => (
                  <TouchableOpacity
                    key={`${row.id}-${i}`}
                    style={[
                      styles.dataRow,
                      i === brands.length - 1 && styles.dataRowLast,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedBrand(row)}
                  >
                    <View style={styles.nameCellWrap}>
                      <Text style={styles.nameText} numberOfLines={2}>
                        {row.label}
                      </Text>
                    </View>
                    <Text style={styles.qtyCell}>
                      {row.qty.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                    <Text style={styles.valueCell}>
                      {formatCurrency(row.value, "SAR", {
                        compact: true,
                        hideCode: true,
                      })}
                    </Text>
                    <View style={styles.chevCell}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={INVENTORY.subtitle}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                {selectedBrand && !selectedItem ? (
                  <View style={styles.itemFilterWrap}>
                    <TextInput
                      style={styles.itemFilterInput}
                      value={itemFilter}
                      onChangeText={setItemFilter}
                      placeholder="Filter by item code or name"
                      placeholderTextColor={INVENTORY.subtitle}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                ) : null}
                {drillLoading ? (
                  <ActivityIndicator
                    style={styles.inlineLoader}
                    color={INVENTORY.link}
                  />
                ) : null}
                {!drillLoading && !filteredItems.length ? (
                  <Text style={styles.empty}>
                    {items.length
                      ? "No items match your filter."
                      : "No items for this brand."}
                  </Text>
                ) : null}
                {filteredItems.map((row, i) => (
                  <TouchableOpacity
                    key={`${row.id}-${i}`}
                    style={[
                      styles.itemCard,
                      i === filteredItems.length - 1 && styles.itemCardLast,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => void loadItemWarehouseDetail(row)}
                  >
                    <View style={styles.itemCardBody}>
                      <View style={styles.itemCardMain}>
                        {row.code ? (
                          <Text style={styles.itemCode} numberOfLines={1}>
                            {row.code}
                          </Text>
                        ) : null}
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {row.label}
                        </Text>
                      </View>
                      <View style={styles.itemCardMetrics}>
                        <Text style={styles.itemMetricQty}>
                          {row.qty.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </Text>
                        <Text style={styles.itemMetricVal}>
                          {formatCurrency(row.value, "SAR", {
                            compact: true,
                            hideCode: true,
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={INVENTORY.subtitle}
                        style={styles.itemChev}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: INVENTORY.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
    backgroundColor: INVENTORY.card,
  },
  headerText: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    textAlign: "center",
    lineHeight: 15,
  },
  headerSpacer: { width: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: INVENTORY.red,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  filtersPanel: {
    backgroundColor: INVENTORY.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 30,
  },
  filterRowLabel: {
    width: 68,
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.subtitle,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    paddingRight: 4,
  },
  filterRowScroll: {
    flex: 1,
    minWidth: 0,
  },
  filterRowScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: INVENTORY.bg,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: INVENTORY.link,
    borderColor: INVENTORY.link,
  },
  chipText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.value,
  },
  chipTextActive: { color: "#fff" },
  card: {
    backgroundColor: INVENTORY.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
    borderWidth: 1,
    borderColor: INVENTORY.border,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    letterSpacing: 0.4,
  },
  cardCount: {
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
    backgroundColor: INVENTORY.bg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INVENTORY.border,
    marginBottom: 2,
  },
  th: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  thName: { flex: 1, minWidth: 0 },
  thQty: { width: COL_QTY, textAlign: "right" },
  thVal: { width: COL_VAL, textAlign: "right" },
  thChev: { width: COL_CHEV },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  dataRowLast: {
    borderBottomWidth: 0,
  },
  nameCellWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  nameText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    lineHeight: 17,
  },
  itemCode: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
    marginBottom: 2,
  },
  qtyCell: {
    width: COL_QTY,
    textAlign: "right",
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    fontVariant: ["tabular-nums"],
  },
  valueCell: {
    width: COL_VAL,
    textAlign: "right",
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.value,
    fontVariant: ["tabular-nums"],
  },
  chevCell: {
    width: COL_CHEV,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  inlineLoader: { marginVertical: 20 },
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  loadingHint: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  empty: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    textAlign: "center",
    paddingVertical: 20,
  },
  itemCard: {
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: INVENTORY.bg,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  itemCardLast: {
    marginBottom: 0,
  },
  itemCardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  itemCardMain: {
    flex: 1,
    minWidth: 0,
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    lineHeight: 16,
    marginTop: 2,
  },
  findBanner: {
    backgroundColor: INVENTORY.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INVENTORY.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  findBannerTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
  },
  itemFilterWrap: {
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  itemFilterInput: {
    borderWidth: 1,
    borderColor: INVENTORY.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    backgroundColor: INVENTORY.bg,
  },
  whHint: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.link,
  },
  itemCardMetrics: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  itemMetricQty: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    fontVariant: ["tabular-nums"],
  },
  itemMetricVal: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
    fontVariant: ["tabular-nums"],
  },
  itemChev: {
    marginLeft: 2,
  },
  itemHeroName: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: INVENTORY.value,
    lineHeight: 16,
    marginBottom: 6,
  },
  itemHeroTotals: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  doiSub: {
    marginBottom: 8,
    fontSize: 10,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    lineHeight: 13,
  },
  heroStat: {
    flex: 1,
    backgroundColor: INVENTORY.bg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  heroStatDoi: {
    color: INVENTORY.link,
    fontSize: 14,
  },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.subtitle,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  heroStatValue: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.title,
    fontVariant: ["tabular-nums"],
  },
  whTerritory: {
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    color: INVENTORY.link,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  whName: {
    fontSize: 13,
    fontFamily: Fonts.bodySemi,
    color: INVENTORY.value,
  },
  whFullName: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: Fonts.body,
    color: INVENTORY.subtitle,
    lineHeight: 13,
  },
});
