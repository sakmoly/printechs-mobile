/**
 * Static sample data when no ERP server URL is configured (demo / review mode).
 */
export function getDemoDashboardData(user: {
  full_name?: string;
  username?: string;
  email?: string;
  company?: string;
  designation?: string;
  image?: string;
  user_image?: string;
  photo_url?: string;
} | null) {
  const name =
    user?.full_name ||
    (user?.username ? String(user.username).split("@")[0] : "") ||
    "Demo User";
  const email = user?.email || user?.username || "demo@printechs.com";
  const img =
    user?.user_image || user?.image || user?.photo_url || "";

  return {
    kpis: [
      {
        id: "sales_today",
        title: "SALES Today",
        value: 97291.0,
        change_percentage: 0.0,
        change_direction: "neutral",
        currency: "SAR",
      },
      {
        id: "sales_mtd",
        title: "SALES MTD",
        value: 2272319.53,
        change_percentage: -28.4,
        change_direction: "down",
        currency: "SAR",
        previous_year_value: 3172618.45,
      },
      {
        id: "sales_ytd",
        title: "SALES YTD",
        value: 30337829.76,
        change_percentage: 4.2,
        change_direction: "up",
        currency: "SAR",
        previous_year_value: 29120904.92,
      },
      {
        id: "gross_margin",
        title: "GROSS MARGIN",
        value: 38.6,
        change_percentage: 2.1,
        change_direction: "up",
        unit: "%",
      },
    ],
    user_profile: {
      image_url: img,
      employee_name: name,
      company: user?.company || "Printechs (Demo)",
      designation: user?.designation || "Demo",
      branch: "",
      cell_number: "",
      company_email: email,
      current_address: "",
      country: "",
    },
    charts: {
      sales_daily: [],
      sales_by_territory: [],
      sales_by_division: [],
    },
    sales_dashboard: {
      metrics: {
        totalSales: 2018190.53,
        totalInvoices: 150,
        avgInvoiceValue: 13454.6,
        costOfGoodsSold: 1500000.0,
        grossProfit: 518190.53,
        grossProfitPercentage: 25.7,
      },
      top_brands: [
        {
          brand: "Hitachi",
          total_sales: 500000,
          total_quantity: 1200,
          total_cost: 350000,
          gross_profit_amount: 150000,
          gross_profit_percent: 30.0,
          invoice_count: 45,
        },
        {
          brand: "Nedap",
          total_sales: 300000,
          total_quantity: 800,
          total_cost: 200000,
          gross_profit_amount: 100000,
          gross_profit_percent: 33.3,
          invoice_count: 25,
        },
      ],
      top_customers: [
        {
          customer: "CUST001",
          customer_name: "Customer A",
          total_sales: 200000,
          invoice_count: 12,
        },
        {
          customer: "CUST002",
          customer_name: "Customer B",
          total_sales: 150000,
          invoice_count: 8,
        },
      ],
      monthly_trend: {
        labels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        current: [
          100000, 150000, 200000, 180000, 220000, 250000, 230000, 280000,
          300000, 201819, 0, 0,
        ],
        previous: [
          90000, 140000, 180000, 160000, 200000, 230000, 210000, 260000,
          280000, 190000, 180000, 200000,
        ],
      },
      territory: [
        { territory: "Riyadh", total_sales: 800000, invoice_count: 50 },
        { territory: "Jeddah", total_sales: 600000, invoice_count: 40 },
        { territory: "Dammam", total_sales: 400000, invoice_count: 30 },
      ],
      division: [
        {
          division: "Industrial",
          total_sales: 1200000,
          margin_percentage: 28.5,
        },
        {
          division: "Retail",
          total_sales: 800000,
          margin_percentage: 22.0,
        },
        {
          division: "Software",
          total_sales: 200000,
          margin_percentage: 45.0,
        },
      ],
    },
    date: new Date().toLocaleDateString(),
  };
}

export function getDemoReceivablesSnapshot() {
  return {
    totalUnpaid: 2_450_000,
    totalOverdue: 320_000,
    overdueLt400: 0,
    oldBalance: 45_000,
    overdue_0_30: 180_000,
    overdue_31_60: 95_000,
    overdue_61_90: 28_000,
    overdue_over_90: 17_000,
    overduePercentage: 13.1,
    dso: 42,
    averageCollectionPeriod: 38,
  };
}

export function getDemoReceivablesPerformance() {
  return {
    topOverdueCustomers: [
      { name: "ACME Corp", customer: "CUST-001", amount: 125000 },
      { name: "Tech Solutions", customer: "CUST-002", amount: 89000 },
    ],
    topOverdueInvoices: [
      { invoice: "SI-00123", customer: "ACME Corp", amount: 45000, days: 45 },
      { invoice: "SI-00108", customer: "Retail Group", amount: 32000, days: 62 },
    ],
    agingBreakdown: [
      { period: "Current", amount: 890000 },
      { period: "1-30 Days", amount: 420000 },
      { period: "31-60 Days", amount: 195000 },
      { period: "61-90 Days", amount: 88000 },
      { period: "91-120 Days", amount: 42000 },
      { period: "Old Balance", amount: 45000 },
    ],
    collectionEfficiency: 87.5,
  };
}

export function getDemoReceivablesTrend() {
  return {
    arTrend: [
      { month: "Jan", amount: 2100000 },
      { month: "Feb", amount: 2250000 },
      { month: "Mar", amount: 2450000 },
    ],
    receivableByTerritory: [
      { territory: "Riyadh", amount: 1200000, percentage: 49 },
      { territory: "Jeddah", amount: 750000, percentage: 31 },
      { territory: "Dammam", amount: 500000, percentage: 20 },
    ],
    overdueByTerritory: [
      { territory: "Riyadh", overdue: 140000 },
      { territory: "Jeddah", overdue: 98000 },
      { territory: "Dammam", overdue: 82000 },
    ],
    monthlyOverdueTrend: [
      { month: "Jan", overdue: 280000 },
      { month: "Feb", overdue: 300000 },
      { month: "Mar", overdue: 320000 },
    ],
    monthlySalesVsCollection: [
      { month: "Jan", sales: 1800000, collection: 1650000 },
      { month: "Feb", sales: 1950000, collection: 1720000 },
      { month: "Mar", sales: 2100000, collection: 1880000 },
    ],
  };
}

export function getDemoInventorySnapshot() {
  return {
    totalInventoryValue: 12_500_000,
    totalSkuCount: 1284,
    lowStockCount: 12,
  };
}

export function getDemoInventoryPerformance() {
  return {
    reorderAlerts: [
      { item_code: "ITEM-001", item_name: "Demo Item A", stock_qty: 4, reorder_level: 20 },
      { item_code: "ITEM-002", item_name: "Demo Item B", stock_qty: 8, reorder_level: 25 },
    ],
    topMovingItems: [],
    slowMovingItems: [],
  };
}

export function getDemoInventoryTrends() {
  return {
    months: ["Jan", "Feb", "Mar"],
    stockValue: [11.2e6, 11.8e6, 12.5e6],
    turnoverRatio: [4.2, 4.4, 4.5],
  };
}

export function getDemoInventoryRisk() {
  return {
    riskBuckets: [],
    deadStockValue: 0,
    excessStockValue: 0,
  };
}

export function getDemoInventoryHierarchy() {
  return { level: "category", rows: [] as unknown[] };
}

export function getDemoCataloguesList() {
  return {
    catalogues: [
      {
        id: "demo-cat-1",
        name: "demo-catalogue-1",
        title: "Industrial Catalogue (Demo)",
        description: "Sample catalogue for App Store review — not connected to a live ERP.",
        item_group: "Industrial",
        thumbnail_url: null,
        video_count: 0,
        youtube_video_url: null,
        videos: [],
      },
    ],
    total: 1,
  };
}
