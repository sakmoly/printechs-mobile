import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useInventorySnapshot,
  useInventoryPerformance,
  useInventoryTrends,
  useInventoryRisk,
  useInventoryHierarchy,
} from "../src/hooks/useOptimizedApis";

const { width } = Dimensions.get("window");

type TabType = "snapshot" | "performance" | "trend" | "risk";

// Mock Data
const MOCK_DATA = {
  snapshot: {
    totalInventoryValue: 12500000,
    inventoryTurnoverRatio: 4.5,
    averageDaysInInventory: 81,
    agingBreakdown: [
      { period: "0-30 Days", value: 8500000, percentage: 68.0 },
      { period: "31-60 Days", value: 2500000, percentage: 20.0 },
      { period: "61-90 Days", value: 1000000, percentage: 8.0 },
      { period: "91-180 Days", value: 400000, percentage: 3.2 },
      { period: "181-365 Days", value: 50000, percentage: 0.4 },
      { period: "Over 365 Days", value: 50000, percentage: 0.4 },
    ],
    inventoryByCategory: [
      { category: "Electronics", value: 5000000, percentage: 40.0 },
      { category: "Office Supplies", value: 3750000, percentage: 30.0 },
      { category: "Accessories", value: 3750000, percentage: 30.0 },
    ],
  },
  performance: {
    fastMovingItems: [
      {
        itemCode: "ITEM-001",
        itemName: "Laptop Dell XPS",
        quantity: 1500,
        value: 75000,
      },
      {
        itemCode: "ITEM-002",
        itemName: "Mouse Wireless",
        quantity: 1200,
        value: 24000,
      },
      {
        itemCode: "ITEM-003",
        itemName: "Keyboard Mechanical",
        quantity: 950,
        value: 28500,
      },
    ],
    slowMovingItems: [
      {
        itemCode: "ITEM-101",
        itemName: "Old Printer",
        quantity: 50,
        value: 2500,
        daysSinceLastMovement: 120,
      },
      {
        itemCode: "ITEM-102",
        itemName: "Legacy Scanner",
        quantity: 30,
        value: 1500,
        daysSinceLastMovement: 180,
      },
      {
        itemCode: "ITEM-103",
        itemName: "Vintage Keyboard",
        quantity: 20,
        value: 800,
        daysSinceLastMovement: 200,
      },
    ],
    reorderAlerts: [
      {
        itemCode: "ITEM-201",
        itemName: "USB Cable",
        currentStock: 10,
        reorderLevel: 50,
        shortage: 40,
      },
      {
        itemCode: "ITEM-202",
        itemName: "HDMI Cable",
        currentStock: 15,
        reorderLevel: 60,
        shortage: 45,
      },
    ],
    overstockAlerts: [
      {
        itemCode: "ITEM-301",
        itemName: "Monitor Stand",
        currentStock: 500,
        maxStockLevel: 200,
        excess: 300,
      },
      {
        itemCode: "ITEM-302",
        itemName: "Cable Organizer",
        currentStock: 350,
        maxStockLevel: 150,
        excess: 200,
      },
    ],
  },
  trend: {
    movementInOut: [
      {
        month: "Jan",
        inQuantity: 5000,
        outQuantity: 4500,
        inValue: 250000,
        outValue: 225000,
      },
      {
        month: "Feb",
        inQuantity: 5200,
        outQuantity: 4800,
        inValue: 260000,
        outValue: 240000,
      },
      {
        month: "Mar",
        inQuantity: 4800,
        outQuantity: 5000,
        inValue: 240000,
        outValue: 250000,
      },
      {
        month: "Apr",
        inQuantity: 5500,
        outQuantity: 5200,
        inValue: 275000,
        outValue: 260000,
      },
      {
        month: "May",
        inQuantity: 5100,
        outQuantity: 4800,
        inValue: 255000,
        outValue: 240000,
      },
      {
        month: "Jun",
        inQuantity: 5300,
        outQuantity: 5100,
        inValue: 265000,
        outValue: 255000,
      },
    ],
    inventoryValueTrend: [
      { month: "Jan", value: 12000000 },
      { month: "Feb", value: 12200000 },
      { month: "Mar", value: 12150000 },
      { month: "Apr", value: 12350000 },
      { month: "May", value: 12400000 },
      { month: "Jun", value: 12500000 },
    ],
    stockByWarehouse: [
      { warehouse: "Main Warehouse", value: 7500000, percentage: 60.0 },
      { warehouse: "Secondary Warehouse", value: 3500000, percentage: 28.0 },
      { warehouse: "Store Room", value: 1500000, percentage: 12.0 },
    ],
  },
  risk: {
    nonMovingItems: [
      {
        itemCode: "ITEM-501",
        itemName: "Outdated CPU",
        warehouse: "Main Warehouse",
        quantity: 100,
        value: 10000,
        daysSinceLastMovement: 180,
      },
      {
        itemCode: "ITEM-502",
        itemName: "Old RAM Modules",
        warehouse: "Main Warehouse",
        quantity: 200,
        value: 8000,
        daysSinceLastMovement: 220,
      },
      {
        itemCode: "ITEM-503",
        itemName: "Legacy HDD",
        warehouse: "Store Room",
        quantity: 150,
        value: 4500,
        daysSinceLastMovement: 300,
      },
    ],
    agingSummary: [
      { bucket: "0-30 Days", itemCount: 250, totalValue: 8500000 },
      { bucket: "31-60 Days", itemCount: 150, totalValue: 2500000 },
      { bucket: "61-90 Days", itemCount: 80, totalValue: 1000000 },
      { bucket: "91-180 Days", itemCount: 40, totalValue: 400000 },
      { bucket: "181-365 Days", itemCount: 20, totalValue: 50000 },
      { bucket: "Over 365 Days", itemCount: 10, totalValue: 50000 },
    ],
    criticalShortage: [
      {
        itemCode: "ITEM-201",
        itemName: "USB Cable",
        currentStock: 10,
        safetyStock: 50,
      },
      {
        itemCode: "ITEM-601",
        itemName: "Power Adapter",
        currentStock: 8,
        safetyStock: 40,
      },
    ],
    overstock: [
      {
        itemCode: "ITEM-301",
        itemName: "Monitor Stand",
        currentStock: 500,
        maxStock: 200,
        excessValue: 120000,
      },
      {
        itemCode: "ITEM-302",
        itemName: "Cable Organizer",
        currentStock: 350,
        maxStock: 150,
        excessValue: 80000,
      },
    ],
  },
};

type DrillDownLevel =
  | "category"
  | "item_group"
  | "brand"
  | "item"
  | "warehouse";

interface Breadcrumb {
  level: DrillDownLevel;
  label: string;
  value: string;
}

export default function InventoryDashboardScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("snapshot");
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel | null>(
    null
  );
  const [drillDownFilters, setDrillDownFilters] = useState<{
    category?: string;
    item_group?: string;
    brand?: string;
    item_code?: string;
  }>({});
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
    // Reset drill-down when switching tabs
    setDrillDownLevel(null);
    setDrillDownFilters({});
    setBreadcrumbs([]);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Fetch real API data
  const {
    data: snap,
    isLoading: snapLoading,
    error: snapError,
    refetch: refetchSnap,
  } = useInventorySnapshot();
  const {
    data: perf,
    isLoading: perfLoading,
    error: perfError,
    refetch: refetchPerf,
  } = useInventoryPerformance({ limit: 10 });
  const today = new Date();
  const year = today.getFullYear();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const {
    data: trend,
    isLoading: trendLoading,
    error: trendError,
    refetch: refetchTrend,
  } = useInventoryTrends({ from_date: `${year}-01-01`, to_date: toIso(today) });
  const {
    data: risk,
    isLoading: riskLoading,
    error: riskError,
    refetch: refetchRisk,
  } = useInventoryRisk();

  // Fetch drill-down data - only when drill-down is active
  const {
    data: hierarchyData,
    isLoading: hierarchyLoading,
    error: hierarchyError,
    refetch: refetchHierarchy,
  } = useInventoryHierarchy(
    drillDownLevel
      ? {
          level: drillDownLevel,
          ...drillDownFilters,
        }
      : {
          level: "category", // Default, but this won't be called if drillDownLevel is null
        },
    {
      enabled: drillDownLevel !== null, // Only fetch when drill-down is active
    }
  );

  // Debug logging for hierarchy data
  React.useEffect(() => {
    if (hierarchyData) {
      console.log("🔍 Hierarchy Data Received:", {
        level: drillDownLevel,
        filters: drillDownFilters,
        dataType: Array.isArray(hierarchyData) ? "array" : typeof hierarchyData,
        dataLength: Array.isArray(hierarchyData)
          ? hierarchyData.length
          : "not array",
        sample: Array.isArray(hierarchyData)
          ? hierarchyData.slice(0, 2)
          : hierarchyData,
      });
    }
  }, [hierarchyData, drillDownLevel, drillDownFilters]);

  const handleRefreshAll = () => {
    refetchSnap();
    refetchPerf();
    refetchTrend();
    refetchRisk();
    // Reset drill-down
    setDrillDownLevel(null);
    setDrillDownFilters({});
    setBreadcrumbs([]);
  };

  const handleDrillDown = (
    nextLevel: DrillDownLevel,
    label: string,
    value: string
  ) => {
    console.log("🔍 Drill Down:", {
      currentLevel: drillDownLevel,
      nextLevel,
      label,
      value,
      currentFilters: drillDownFilters,
      currentBreadcrumbs: breadcrumbs,
    });

    // Update filters first based on current level
    // Flow: Category -> Brand -> Item Group -> Item
    setDrillDownFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      switch (drillDownLevel || "category") {
        case "category":
          // When clicking category, use it as category filter for brand query
          newFilters.category = value;
          console.log("✅ Setting category filter:", value);
          break;
        case "brand":
          // When clicking brand, use it as brand filter for item_group query
          newFilters.brand = value;
          // Preserve category if available
          break;
        case "item_group":
          // When clicking item_group, use it as item_group filter for item query
          newFilters.item_group = value;
          // Preserve brand and category if available
          break;
        case "item":
          newFilters.item_code = value;
          break;
      }
      console.log("✅ New filters set:", newFilters);
      return newFilters;
    });

    // Rebuild breadcrumbs based on the new filters and level
    // This ensures breadcrumbs are always consistent with the current state
    setBreadcrumbs((prevBreadcrumbs) => {
      // Get the current level that we're leaving (before moving to next)
      const currentLevel = drillDownLevel || "category";

      // If we're at category level (null), start fresh
      if (currentLevel === null || currentLevel === "category") {
        return [
          {
            level: "category",
            label,
            value,
          },
        ];
      }

      // For other levels, truncate breadcrumbs up to the current level
      // and add the new breadcrumb
      // This prevents duplicates when navigating back and forth
      const levelOrder: DrillDownLevel[] = [
        "category",
        "brand",
        "item_group",
        "item",
        "warehouse",
      ];
      const currentLevelIndex = levelOrder.indexOf(currentLevel);

      // Keep only breadcrumbs up to (but not including) the current level
      const truncatedBreadcrumbs = prevBreadcrumbs.filter((crumb) => {
        const crumbLevelIndex = levelOrder.indexOf(crumb.level);
        return crumbLevelIndex < currentLevelIndex;
      });

      // Add the new breadcrumb for the current level we're leaving
      return [
        ...truncatedBreadcrumbs,
        {
          level: currentLevel,
          label,
          value,
        },
      ];
    });

    setDrillDownLevel(nextLevel); // Move to next level
  };

  const handleDrillDownBack = () => {
    console.log("🔙 Drill Down Back:", {
      breadcrumbsLength: breadcrumbs.length,
      currentLevel: drillDownLevel,
      currentFilters: drillDownFilters,
      breadcrumbs,
    });

    if (breadcrumbs.length === 0 || drillDownLevel === null) {
      // Going back to categories view
      setDrillDownLevel(null);
      setDrillDownFilters({});
      setBreadcrumbs([]);
      return;
    }

    // Determine previous level based on actual navigation flow
    // Flow: Category (null) -> Brand -> Item Group -> Item -> Warehouse
    // When going back from Brand, go directly to null (Inventory by Category)
    const levelMap: Record<DrillDownLevel, DrillDownLevel | null> = {
      category: null,
      brand: null, // Brand -> directly back to Inventory by Category (null)
      item_group: "brand",
      item: "item_group",
      warehouse: "item",
    };
    const prevLevel = levelMap[drillDownLevel];

    console.log("🔙 Going back to level:", {
      fromLevel: drillDownLevel,
      toLevel: prevLevel,
    });

    // If going back to category view (null), clear all filters and breadcrumbs
    // This happens when going back from Brand level or Category level
    if (prevLevel === null || drillDownLevel === "brand") {
      setDrillDownLevel(null);
      setDrillDownFilters({});
      setBreadcrumbs([]);
      return;
    }

    // Truncate breadcrumbs to remove the current level and any deeper levels
    const levelOrder: DrillDownLevel[] = [
      "category",
      "brand",
      "item_group",
      "item",
      "warehouse",
    ];
    const currentLevelIndex = levelOrder.indexOf(drillDownLevel);

    // Keep only breadcrumbs up to (but not including) the current level
    const newBreadcrumbs = breadcrumbs.filter((crumb) => {
      const crumbLevelIndex = levelOrder.indexOf(crumb.level);
      return crumbLevelIndex < currentLevelIndex;
    });

    // Update breadcrumbs state
    setBreadcrumbs(newBreadcrumbs);

    // Rebuild filters from remaining breadcrumbs
    const newFilters: {
      category?: string;
      item_group?: string;
      brand?: string;
      item_code?: string;
    } = {};

    // Build filters based on remaining breadcrumbs
    const categoryItem = newBreadcrumbs.find((c) => c.level === "category");
    const itemGroupItem = newBreadcrumbs.find((c) => c.level === "item_group");
    const brandItem = newBreadcrumbs.find((c) => c.level === "brand");
    const itemItem = newBreadcrumbs.find((c) => c.level === "item");

    // Set filters based on what we found
    if (categoryItem) {
      newFilters.category = categoryItem.value;
    }
    if (itemGroupItem) {
      newFilters.item_group = itemGroupItem.value;
    }
    if (brandItem) {
      newFilters.brand = brandItem.value;
    }
    if (itemItem) {
      newFilters.item_code = itemItem.value;
    }

    setDrillDownLevel(prevLevel);
    setDrillDownFilters(newFilters);

    console.log("✅ Back navigation complete:", {
      newLevel: prevLevel,
      newFilters,
      remainingBreadcrumbs: newBreadcrumbs.length,
    });
  };

  const renderCategories = (categories: any[]) => {
    // Filter out NULL/undefined categories, empty strings, and "Unknown" entries
    const validCategories = (categories || []).filter((item) => {
      // Check if category exists and is not null/undefined
      if (
        !item.category ||
        item.category === null ||
        item.category === undefined
      ) {
        return false;
      }
      // Convert to string, trim whitespace, and check if it's empty or "Unknown"
      const categoryStr = String(item.category).trim();
      return categoryStr !== "" && categoryStr.toLowerCase() !== "unknown";
    });

    if (validCategories.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No categories found</Text>
        </View>
      );
    }

    // Sort by value in descending order (highest value first)
    const sortedCategories = [...validCategories].sort(
      (a, b) => (b.value || 0) - (a.value || 0)
    );

    return (
      <>
        {sortedCategories.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.categoryRow}
            onPress={() =>
              handleDrillDown("brand", item.category, item.category)
            }
          >
            <View style={styles.categoryLeft}>
              <Text style={styles.categoryName}>{item.category}</Text>
              <View style={styles.categoryBar}>
                <View
                  style={[
                    styles.categoryBarFill,
                    { width: `${item.percentage}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.categoryRight}>
              <Text style={styles.categoryPercentage}>{item.percentage}%</Text>
              <Text style={styles.categoryValue}>
                {formatCurrency(item.value)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#667eea"
                style={styles.chevronIcon}
              />
            </View>
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const renderDrillDownContent = () => {
    if (hierarchyLoading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      );
    }

    if (hierarchyError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text
            style={[
              styles.emptyText,
              {
                color: "#ef4444",
                marginTop: 8,
                fontWeight: "bold",
                marginBottom: 8,
              },
            ]}
          >
            Error Loading Data
          </Text>
          <Text
            style={[
              styles.emptyText,
              {
                color: "#ef4444",
                fontSize: 14,
                textAlign: "center",
                marginBottom: 16,
              },
            ]}
          >
            {hierarchyError instanceof Error
              ? hierarchyError.message
              : "Failed to load data"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetchHierarchy()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Enhanced debugging
    console.log("🔍 renderDrillDownContent Debug:", {
      drillDownLevel,
      drillDownFilters,
      hierarchyLoading,
      hierarchyError: hierarchyError
        ? (hierarchyError as any) instanceof Error
          ? (hierarchyError as Error).message
          : String(hierarchyError)
        : null,
      hierarchyData,
      isArray: Array.isArray(hierarchyData),
      dataLength: Array.isArray(hierarchyData)
        ? hierarchyData.length
        : "not array",
      dataType: typeof hierarchyData,
    });

    if (!hierarchyData) {
      console.log("⚠️ hierarchyData is null/undefined");
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available (null)</Text>
        </View>
      );
    }

    if (!Array.isArray(hierarchyData)) {
      console.log(
        "⚠️ hierarchyData is not an array:",
        typeof hierarchyData,
        hierarchyData
      );
      // Try to handle if it's wrapped in an object
      const arrayData =
        (hierarchyData as any).data ||
        (hierarchyData as any).items ||
        (hierarchyData as any).results;
      if (Array.isArray(arrayData)) {
        console.log("✅ Found array in wrapper, using it");
        // Use the array from the wrapper
        return (
          <>
            {arrayData.map((item: any, index: number) => {
              const titleKey =
                drillDownLevel === "item_group"
                  ? "item_group"
                  : drillDownLevel === "brand"
                  ? "brand"
                  : drillDownLevel === "item"
                  ? "item_name"
                  : "";

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.drillDownRow}
                  onPress={() => {
                    const nextLevel = getNextLevel();
                    if (nextLevel) {
                      const brandValue =
                        item[titleKey] || item.name || item.item_code;
                      handleDrillDown(nextLevel, brandValue, brandValue);
                    }
                  }}
                >
                  <View style={styles.drillDownLeft}>
                    <Text style={styles.drillDownTitle}>
                      {item[titleKey] ||
                        item.name ||
                        item.item_code ||
                        "Unknown"}
                    </Text>
                  </View>
                  <View style={styles.drillDownRight}>
                    <Text style={styles.drillDownValue}>
                      {formatCurrency(item.value || item.total_value || 0)} SAR
                    </Text>
                    <Text style={styles.drillDownQuantity}>
                      Qty: {item.quantity || item.total_quantity || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        );
      }
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available (not array)</Text>
          <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4 }]}>
            Type: {typeof hierarchyData}
          </Text>
        </View>
      );
    }

    if (hierarchyData.length === 0) {
      console.log("⚠️ hierarchyData array is empty");
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data found</Text>
        </View>
      );
    }

    console.log(
      "✅ Rendering hierarchyData array with length:",
      hierarchyData.length
    );

    const getNextLevel = (): DrillDownLevel | null => {
      const levelMap: Record<DrillDownLevel, DrillDownLevel | null> = {
        category: "brand", // Category -> Brand
        brand: "item_group", // Brand -> Item Group
        item_group: "item", // Item Group -> Item
        item: "warehouse",
        warehouse: null,
      };
      return drillDownLevel ? levelMap[drillDownLevel] : null;
    };

    const nextLevel = getNextLevel();

    if (drillDownLevel === "warehouse") {
      // Final level - show warehouse details
      console.log("🏢 Rendering warehouse level:", {
        drillDownLevel,
        hierarchyDataLength: hierarchyData.length,
        drillDownFilters,
        sampleData: hierarchyData.slice(0, 2),
      });

      if (hierarchyData.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No warehouse data found</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4 }]}>
              Filters: {JSON.stringify(drillDownFilters)}
            </Text>
          </View>
        );
      }

      return (
        <>
          {hierarchyData.map((item: any, index: number) => {
            // Check multiple possible field names for warehouse
            const warehouseName =
              item.warehouse ||
              item.Warehouse ||
              item.wh ||
              item.warehouse_name ||
              item.name ||
              item.label ||
              "Unknown Warehouse";

            // Debug logging for first item
            if (index === 0) {
              console.log("🏢 Rendering warehouse item:", {
                item,
                warehouseName,
                allFields: Object.keys(item),
              });
            }

            return (
              <View key={index} style={styles.warehouseRow}>
                <View style={styles.warehouseLeft}>
                  <Ionicons name="cube-outline" size={24} color="#667eea" />
                  <View style={styles.warehouseInfo}>
                    <Text style={styles.warehouseName}>{warehouseName}</Text>
                    <Text style={styles.warehouseUom}>
                      UOM: {item.uom || item.uom_name || "Nos"}
                    </Text>
                  </View>
                </View>
                <View style={styles.warehouseRight}>
                  <Text style={styles.warehouseValue}>
                    {formatCurrency(item.value || item.stock_value || 0)} SAR
                  </Text>
                  <Text style={styles.warehouseQuantity}>
                    {item.quantity || item.actual_qty || 0} units
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      );
    }

    // List view for item_group, brand, and item levels
    return (
      <>
        {hierarchyData.map((item: any, index: number) => {
          // Determine the display field based on drill-down level
          // API returns: brand level -> "brand", item_group level -> "item_group", item level -> "item_name"
          let displayText = "";
          if (drillDownLevel === "brand") {
            displayText =
              item.brand || item.Brand || item.name || "Unknown Brand";
          } else if (drillDownLevel === "item_group") {
            displayText =
              item.item_group ||
              item.Item_type_name ||
              item.name ||
              "Unknown Item Group";
          } else if (drillDownLevel === "item") {
            // For items, API returns: item_name, item_code
            displayText =
              item.item_name ||
              item.itemName ||
              item.item_code ||
              item.itemCode ||
              item.name ||
              "Unknown Item";
          } else {
            displayText = item.name || item.label || "Unknown";
          }

          // Determine the titleKey for navigation (what field to use when clicking)
          const titleKey =
            drillDownLevel === "item_group"
              ? "item_group"
              : drillDownLevel === "brand"
              ? "brand"
              : drillDownLevel === "item"
              ? "item_name" // Display name, but we'll use item_code for navigation
              : "";

          // Debug logging for each item
          if (index === 0) {
            console.log("🔍 Rendering item:", {
              drillDownLevel,
              titleKey,
              item,
              displayText,
              titleValue: item[titleKey],
              value: item.value,
              total_value: item.total_value,
              quantity: item.quantity,
              total_quantity: item.total_quantity,
            });
          }

          return (
            <TouchableOpacity
              key={index}
              style={styles.drillDownRow}
              onPress={() => {
                if (nextLevel) {
                  // Determine the value to pass based on the next level
                  let valueToPass: string;

                  if (drillDownLevel === "item" && nextLevel === "warehouse") {
                    // When clicking item to go to warehouse, MUST use item_code (Item doctype name)
                    // Backend returns: item_code (i.name), item_name (i.item_name), description, brand, etc.
                    // The warehouse query requires item_code which is the Item doctype name, not item_name
                    valueToPass =
                      item.item_code || item.itemCode || item.name || "";

                    console.log(
                      "🔍 Clicking item for warehouse - Full item data:",
                      {
                        fullItem: JSON.stringify(item, null, 2),
                        item_code: item.item_code,
                        itemCode: item.itemCode,
                        name: item.name,
                        item_name: item.item_name,
                        displayText,
                        valueToPass_FINAL: valueToPass,
                        nextLevel,
                        currentFilters: drillDownFilters,
                      }
                    );

                    if (!valueToPass) {
                      console.error(
                        "❌ ERROR: No item_code found for warehouse query!",
                        item
                      );
                      return; // Don't proceed if we don't have item_code
                    }
                  } else {
                    // For other levels, use the titleKey value or fallback
                    valueToPass =
                      item[titleKey] || item.name || item.item_code || "";
                  }

                  handleDrillDown(nextLevel, valueToPass, valueToPass);
                }
              }}
            >
              <View style={styles.drillDownLeft}>
                <Text style={styles.drillDownTitle}>{displayText}</Text>
                {drillDownLevel === "item" && item.description && (
                  <Text style={styles.drillDownDescription}>
                    {item.description}
                  </Text>
                )}
                {(drillDownLevel === "item_group" ||
                  drillDownLevel === "brand") &&
                  item[
                    drillDownLevel === "item_group" ? "category" : "item_group"
                  ] && (
                    <Text style={styles.drillDownSubtitle}>
                      {drillDownLevel === "item_group"
                        ? item.category
                        : item.item_group}
                    </Text>
                  )}
              </View>
              <View style={styles.drillDownRight}>
                <Text style={styles.drillDownValue}>
                  {formatCurrency(item.value || item.total_value || 0)} SAR
                </Text>
                <Text style={styles.drillDownQuantity}>
                  Qty: {item.quantity || item.total_quantity || 0}
                </Text>
                {nextLevel && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#667eea"
                    style={styles.chevronIcon}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  // Snapshot Tab
  const renderSnapshotTab = () => {
    // Handle loading state
    if (snapLoading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading snapshot data...</Text>
          </View>
        </View>
      );
    }

    // Handle error state
    if (snapError) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Error Loading Snapshot Data</Text>
            <Text style={styles.errorText}>
              {snapError instanceof Error
                ? snapError.message
                : "Failed to load inventory snapshot data"}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchSnap()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const data = snap || MOCK_DATA.snapshot;

    // Extract values with fallback for both camelCase and snake_case
    const totalInventoryValue =
      data?.totalInventoryValue ?? data?.total_inventory_value ?? 0;

    const turnoverRatio =
      data?.inventoryTurnoverRatio ??
      data?.inventory_turnover_ratio ??
      data?.turnover_ratio ??
      data?.turnoverRatio ??
      0;

    const avgDays =
      data?.averageDaysInInventory ??
      data?.average_days_in_inventory ??
      data?.avg_days ??
      data?.averageDays ??
      0;

    // Extract inventoryByCategory with support for both camelCase and snake_case
    const inventoryByCategory =
      data?.inventoryByCategory ?? data?.inventory_by_category ?? [];

    // Extract agingBreakdown with support for both camelCase and snake_case
    const agingBreakdown = data?.agingBreakdown ?? data?.aging_breakdown ?? [];

    // Debug logging to see what the API returns
    console.log("🔍 Inventory Snapshot Data:", {
      snap: snap,
      data: data,
      totalInventoryValue,
      inventoryTurnoverRatio: turnoverRatio,
      averageDaysInInventory: avgDays,
      inventoryByCategory,
      categoryCount: Array.isArray(inventoryByCategory)
        ? inventoryByCategory.length
        : 0,
      agingBreakdown,
      agingCount: Array.isArray(agingBreakdown) ? agingBreakdown.length : 0,
    });

    return (
      <View style={styles.tabContent}>
        {/* Total Inventory Value */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="cube" size={24} color="#10b981" />
            <Text style={styles.kpiTitle}>Total Inventory Value</Text>
          </View>
          <Text style={[styles.kpiValue, { color: "#10b981" }]}>
            {formatCurrency(totalInventoryValue)} SAR
          </Text>
        </View>

        {/* Turnover & Days */}
        <View style={styles.metricsRow}>
          <View style={styles.miniKpiCard}>
            <Ionicons name="refresh" size={20} color="#3b82f6" />
            <Text style={styles.miniKpiTitle}>Turnover Ratio</Text>
            <Text style={styles.miniKpiValue}>
              {turnoverRatio > 0 ? `${turnoverRatio.toFixed(1)}x` : "N/A"}
            </Text>
          </View>
          <View style={styles.miniKpiCard}>
            <Ionicons name="calendar" size={20} color="#f59e0b" />
            <Text style={styles.miniKpiTitle}>Avg Days</Text>
            <Text style={styles.miniKpiValue}>
              {avgDays > 0 ? Math.round(avgDays) : "N/A"}
            </Text>
          </View>
        </View>

        {/* Inventory by Category or Drill-Down */}
        <View style={styles.sectionCard}>
          {drillDownLevel === null ? (
            <>
              <Text style={styles.sectionTitle}>Inventory by Category</Text>
              {inventoryByCategory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No categories found</Text>
                </View>
              ) : (
                renderCategories(inventoryByCategory || [])
              )}
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <TouchableOpacity
                    onPress={handleDrillDownBack}
                    style={styles.backButtonSmall}
                  >
                    <Ionicons name="arrow-back" size={20} color="#667eea" />
                  </TouchableOpacity>
                  <Text style={styles.sectionTitle}>
                    {drillDownLevel === "brand"
                      ? "Brands"
                      : drillDownLevel === "item_group"
                      ? "Item Groups"
                      : drillDownLevel === "item"
                      ? "Items"
                      : drillDownLevel === "warehouse"
                      ? "Warehouse Details"
                      : "Inventory by Category"}
                  </Text>
                </View>
                {breadcrumbs.length > 0 && (
                  <View style={styles.breadcrumbsContainer}>
                    {breadcrumbs.map((crumb, idx) => (
                      <Text key={idx} style={styles.breadcrumbText}>
                        {crumb.label}
                        {idx < breadcrumbs.length - 1 && " > "}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              {renderDrillDownContent()}
            </>
          )}
        </View>

        {/* Aging Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Inventory Aging</Text>
          {agingBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No aging data available</Text>
            </View>
          ) : (
            agingBreakdown.map((item: any, index: number) => (
              <View key={index} style={styles.agingRow}>
                <View style={styles.agingLeft}>
                  <Text style={styles.agingLabel}>{item.period}</Text>
                  <View style={styles.agingBar}>
                    <View
                      style={[
                        styles.agingBarFill,
                        { width: `${item.percentage}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.agingAmount}>
                  {formatCurrency(item.value || item.amount || 0)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  // Performance Tab
  const renderPerformanceTab = () => {
    // Handle loading state
    if (perfLoading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading performance data...</Text>
          </View>
        </View>
      );
    }

    // Handle error state
    if (perfError) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>
              Error Loading Performance Data
            </Text>
            <Text style={styles.errorText}>
              {perfError instanceof Error
                ? perfError.message
                : "Failed to load inventory performance data"}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchPerf()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const data = perf || MOCK_DATA.performance;
    return (
      <View style={styles.tabContent}>
        {/* Fast Moving Items */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 3 Fast Moving Items</Text>
          {data.fastMovingItems.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemBar}>
                <View
                  style={[
                    styles.itemBarFill,
                    { width: `${(item.quantity / 1500) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.itemDetails}>
                  Qty: {item.quantity} | Value: {formatCurrency(item.value)} SAR
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Slow Moving Items */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top 3 Slow Moving Items</Text>
          {data.slowMovingItems.map((item: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{item.itemCode}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.daysSinceLastMovement} days
                  </Text>
                </View>
              </View>
              <Text style={styles.itemName}>{item.itemName}</Text>
              <Text style={styles.itemValue}>
                Qty: {item.quantity} | Value: {formatCurrency(item.value)} SAR
              </Text>
            </View>
          ))}
        </View>

        {/* Reorder Alerts */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reorder Alerts</Text>
          {data.reorderAlerts.map((item: any, index: number) => (
            <View
              key={index}
              style={[styles.alertCard, { borderLeftColor: "#ef4444" }]}
            >
              <View style={styles.alertHeader}>
                <Text style={styles.alertItemName}>{item.itemName}</Text>
                <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
                  <Text style={[styles.badgeText, { color: "#ef4444" }]}>
                    Shortage: {item.shortage}
                  </Text>
                </View>
              </View>
              <Text style={styles.alertDetails}>
                Current: {item.currentStock} | Reorder Level:{" "}
                {item.reorderLevel}
              </Text>
            </View>
          ))}
        </View>

        {/* Overstock Alerts */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overstock Alerts</Text>
          {data.overstockAlerts.map((item: any, index: number) => (
            <View
              key={index}
              style={[styles.alertCard, { borderLeftColor: "#f59e0b" }]}
            >
              <View style={styles.alertHeader}>
                <Text style={styles.alertItemName}>{item.itemName}</Text>
                <View style={[styles.badge, { backgroundColor: "#fef3c7" }]}>
                  <Text style={[styles.badgeText, { color: "#f59e0b" }]}>
                    Excess: {item.excess}
                  </Text>
                </View>
              </View>
              <Text style={styles.alertDetails}>
                Current: {item.currentStock} | Max Level: {item.maxStockLevel}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Trend Tab
  const renderTrendTab = () => {
    // Handle loading state
    if (trendLoading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading trend data...</Text>
          </View>
        </View>
      );
    }

    // Handle error state
    if (trendError) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Error Loading Trend Data</Text>
            <Text style={styles.errorText}>
              {trendError instanceof Error
                ? trendError.message
                : "Failed to load inventory trend data"}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchTrend()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const data = trend || MOCK_DATA.trend;
    const movementRaw = (data as any)?.movementInOut
      ? (data as any).movementInOut
      : (data as any)?.receiptsIssuesMonthly
      ? (data as any).receiptsIssuesMonthly.map((r: any) => ({
          month: r.month,
          inQuantity: r.receipts,
          outQuantity: r.issues,
        }))
      : (MOCK_DATA.trend.movementInOut as any);
    // Prefer values; fallback to quantities if values are missing
    const movementSeries = (movementRaw as any[]).map((r: any) => ({
      month: r.month,
      inVal: r.inValue ?? r.receipts ?? r.inQuantity ?? 0,
      outVal: r.outValue ?? r.issues ?? r.outQuantity ?? 0,
    }));
    return (
      <View style={styles.tabContent}>
        {/* Movement In vs Out */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Inventory Movement (In vs Out)
          </Text>
          <View style={styles.movementChart}>
            {(() => {
              const maxIn = Math.max(
                ...movementSeries.map((i: any) => i.inVal),
                1
              );
              const maxOut = Math.max(
                ...movementSeries.map((i: any) => i.outVal),
                1
              );
              const chartMax = Math.max(maxIn, maxOut, 1);
              const toHeight = (v: number): string =>
                `${Math.max(8, (v / chartMax) * 100)}%`;
              return movementSeries.map((item: any, index: number) => (
                <View key={index} style={styles.movementBarContainer}>
                  <View style={styles.movementBarInner}>
                    <View
                      style={[
                        styles.movementBarIn,
                        {
                          height: toHeight(item.inVal) as any,
                          backgroundColor: "#10b981",
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.movementBarOut,
                        {
                          height: toHeight(item.outVal) as any,
                          backgroundColor: "#f59e0b",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.movementLabel}>{item.month}</Text>
                </View>
              ));
            })()}
          </View>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10b981" }]}
              />
              <Text style={styles.legendText}>In</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.legendText}>Out</Text>
            </View>
          </View>
        </View>

        {/* Stock by Warehouse */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stock by Warehouse</Text>
          {data.stockByWarehouse.map((warehouse: any, index: number) => (
            <View key={index} style={styles.warehouseRow}>
              <View style={styles.warehouseLeft}>
                <Text style={styles.warehouseName}>{warehouse.warehouse}</Text>
                <View style={styles.warehouseBar}>
                  <View
                    style={[
                      styles.warehouseBarFill,
                      { width: `${warehouse.percentage}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.warehouseRight}>
                <Text style={styles.warehousePercentage}>
                  {warehouse.percentage}%
                </Text>
                <Text style={styles.warehouseValue}>
                  {formatCurrency(warehouse.value)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Risk Tab
  const renderRiskTab = () => {
    // Handle loading state
    if (riskLoading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading risk data...</Text>
          </View>
        </View>
      );
    }

    // Handle error state
    if (riskError) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Error Loading Risk Data</Text>
            <Text style={styles.errorText}>
              {riskError instanceof Error
                ? riskError.message
                : "Failed to load inventory risk data"}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchRisk()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Extract data from API response
    const raw = (risk as any)?.message ?? (risk as any);
    const data = raw || {};

    // Debug logging
    console.log("🔍 Risk Tab Debug:", {
      risk: risk,
      raw: raw,
      data: data,
      nonMovingItems: data.nonMovingItems,
      agingSummary: data.agingSummary,
      criticalShortage: data.criticalShortage,
      overstock: data.overstock,
    });

    // Extract arrays with proper fallback handling
    const nonMoving = Array.isArray(data.nonMovingItems)
      ? data.nonMovingItems
      : Array.isArray(data.non_moving_items)
      ? data.non_moving_items
      : Array.isArray(data.items)
      ? data.items
      : [];

    const aging = Array.isArray(data.agingSummary)
      ? data.agingSummary
      : Array.isArray(data.aging_summary)
      ? data.aging_summary
      : [];

    const critical = Array.isArray(data.criticalShortage)
      ? data.criticalShortage
      : Array.isArray(data.critical_shortage)
      ? data.critical_shortage
      : [];

    const overstockArr = Array.isArray(data.overstock)
      ? data.overstock
      : Array.isArray(data.over_stock)
      ? data.over_stock
      : [];

    // Empty state message component
    const EmptyState = ({ message }: { message: string }) => (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle-outline" size={32} color="#9ca3af" />
        <Text style={styles.emptyStateText}>{message}</Text>
      </View>
    );

    return (
      <View style={styles.tabContent}>
        {/* Non-Moving Inventory */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Non-Moving Items</Text>
          {nonMoving.length > 0 ? (
            nonMoving.map((item: any, index: number) => (
              <View key={index} style={styles.riskCard}>
                <View style={styles.riskHeader}>
                  <Text style={styles.riskItemCode}>
                    {item.itemCode ?? item.item_code ?? ""}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
                    <Text style={[styles.badgeText, { color: "#ef4444" }]}>
                      {item.daysSinceLastMovement ??
                        item.days_since_last_movement ??
                        0}{" "}
                      days
                    </Text>
                  </View>
                </View>
                <Text style={styles.riskItemName}>
                  {item.itemName ?? item.item_name ?? ""}
                </Text>
                <Text style={styles.riskWarehouse}>
                  {item.warehouse ?? item.wh ?? ""}
                </Text>
                <View style={styles.riskDetails}>
                  <Text style={styles.riskQuantity}>
                    Qty: {item.quantity ?? item.qty ?? 0}
                  </Text>
                  <Text style={styles.riskValue}>
                    Value: {formatCurrency(item.value ?? item.stock_value ?? 0)}{" "}
                    SAR
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState message="No non-moving items found" />
          )}
        </View>

        {/* Aging Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Aging Summary</Text>
          {aging.length > 0 ? (
            aging.map((item: any, index: number) => (
              <View key={index} style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLabel}>
                    {item.bucket ?? item.age_bucket ?? ""}
                  </Text>
                  <Text style={styles.summaryCount}>
                    {item.itemCount ?? item.item_count ?? 0} items
                  </Text>
                </View>
                <Text style={styles.summaryValue}>
                  {formatCurrency(item.totalValue ?? item.total_value ?? 0)}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState message="No aging data available" />
          )}
        </View>

        {/* Critical Shortage */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Critical Shortage</Text>
          {critical.length > 0 ? (
            critical.map((item: any, index: number) => (
              <View
                key={index}
                style={[styles.alertCard, { borderLeftColor: "#dc2626" }]}
              >
                <View style={styles.alertHeader}>
                  <Text style={styles.alertItemName}>
                    {item.itemName ?? item.item_name ?? ""}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
                    <Text style={[styles.badgeText, { color: "#dc2626" }]}>
                      Critical
                    </Text>
                  </View>
                </View>
                <Text style={styles.alertDetails}>
                  Current: {item.currentStock ?? item.current_stock ?? 0} |
                  Safety Stock: {item.safetyStock ?? item.safety_stock ?? 0}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState message="No critical shortages found" />
          )}
        </View>

        {/* Overstock */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overstock Risk</Text>
          {overstockArr.length > 0 ? (
            overstockArr.map((item: any, index: number) => (
              <View key={index} style={styles.overstockCard}>
                <View style={styles.overstockHeader}>
                  <Text style={styles.overstockName}>
                    {item.itemName ?? item.item_name ?? ""}
                  </Text>
                  <Text style={styles.overstockValue}>
                    Excess:{" "}
                    {formatCurrency(item.excessValue ?? item.excess_value ?? 0)}
                  </Text>
                </View>
                <Text style={styles.overstockDetails}>
                  Current: {item.currentStock ?? item.current_stock ?? 0} | Max:{" "}
                  {item.maxStock ?? item.max_stock ?? 0}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState message="No overstock items found" />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#10b981", "#059669"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Inventory</Text>
            <Text style={styles.headerSubtitle}>
              Stock Management Dashboard
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshAll}
          >
            <Ionicons name="refresh-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "snapshot" && styles.activeTab]}
            onPress={() => handleTabPress("snapshot")}
          >
            <Ionicons
              name="pie-chart"
              size={18}
              color={activeTab === "snapshot" ? "#10b981" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "snapshot" && styles.activeTabText,
              ]}
            >
              Snapshot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "performance" && styles.activeTab,
            ]}
            onPress={() => handleTabPress("performance")}
          >
            <Ionicons
              name="bar-chart"
              size={18}
              color={activeTab === "performance" ? "#10b981" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "performance" && styles.activeTabText,
              ]}
            >
              Performance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "trend" && styles.activeTab]}
            onPress={() => handleTabPress("trend")}
          >
            <Ionicons
              name="trending-up"
              size={18}
              color={activeTab === "trend" ? "#10b981" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "trend" && styles.activeTabText,
              ]}
            >
              Trend
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "risk" && styles.activeTab]}
            onPress={() => handleTabPress("risk")}
          >
            <Ionicons
              name="warning"
              size={18}
              color={activeTab === "risk" ? "#10b981" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "risk" && styles.activeTabText,
              ]}
            >
              Risk
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "snapshot" && renderSnapshotTab()}
        {activeTab === "performance" && renderPerformanceTab()}
        {activeTab === "trend" && renderTrendTab()}
        {activeTab === "risk" && renderRiskTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#ffffff",
  },
  tabText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  activeTabText: {
    color: "#10b981",
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
    paddingBottom: 40,
  },
  kpiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  miniKpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  miniKpiTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
  },
  miniKpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  agingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  agingLeft: {
    flex: 1,
    gap: 8,
  },
  agingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  agingBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  agingBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  agingAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryLeft: {
    flex: 1,
    gap: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  categoryBar: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
  },
  categoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  categoryPercentage: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3b82f6",
  },
  categoryValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  itemRow: {
    gap: 8,
    marginBottom: 12,
  },
  itemBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  itemBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  itemInfo: {
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  itemDetails: {
    fontSize: 12,
    color: "#6b7280",
  },
  itemCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  badge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f59e0b",
  },
  itemValue: {
    fontSize: 12,
    color: "#6b7280",
  },
  alertCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  alertDetails: {
    fontSize: 12,
    color: "#6b7280",
  },
  movementChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 150,
    marginTop: 20,
  },
  movementBarContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  movementBarInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    width: "80%",
    height: "100%",
  },
  movementBarIn: {
    flex: 1,
    borderRadius: 4,
  },
  movementBarOut: {
    flex: 1,
    borderRadius: 4,
  },
  movementLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  trendChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 150,
    marginTop: 20,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  trendBar: {
    width: "80%",
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  warehouseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  warehouseLeft: {
    flex: 1,
    gap: 8,
  },
  warehouseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  warehouseBar: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  warehouseBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  warehouseRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  warehousePercentage: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10b981",
  },
  warehouseValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  riskCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  riskItemCode: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  riskItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 4,
  },
  riskWarehouse: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  riskDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  riskQuantity: {
    fontSize: 12,
    color: "#6b7280",
  },
  riskValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2937",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  summaryCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  overstockCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  overstockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  overstockName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  overstockValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f59e0b",
  },
  overstockDetails: {
    fontSize: 12,
    color: "#6b7280",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "600",
  },
  sectionHeader: {
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonSmall: {
    padding: 4,
  },
  breadcrumbsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    color: "#6b7280",
  },
  chevronIcon: {
    marginTop: 4,
  },
  drillDownRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#667eea",
  },
  drillDownLeft: {
    flex: 1,
  },
  drillDownTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  drillDownSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  drillDownDescription: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  drillDownRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  drillDownValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#667eea",
    marginBottom: 4,
  },
  drillDownQuantity: {
    fontSize: 12,
    color: "#6b7280",
  },
  warehouseInfo: {
    flex: 1,
  },
  warehouseUom: {
    fontSize: 12,
    color: "#6b7280",
  },
  warehouseQuantity: {
    fontSize: 12,
    color: "#6b7280",
  },
});
