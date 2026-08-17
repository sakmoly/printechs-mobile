import { useDashboardData } from "./useOptimizedApis";

interface SalesDashboardParams {
  from_date?: string;
  to_date?: string;
  company?: string;
  territory?: string;
  brand?: string;
}

interface SalesChartItem {
  value?: number | string;
  date?: string;
  territory?: string;
  division?: string;
  name?: string;
  invoice_count?: number;
  percentage?: number;
}

export function useSalesDashboard(params: SalesDashboardParams = {}) {
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useDashboardData({
    company: params.company,
    from_date: params.from_date,
    to_date: params.to_date,
  });

  // Debug: Log what we're getting from the dashboard API
  console.log("🔍 Dashboard API Response:", {
    hasDashboardData: !!dashboardData,
    hasSalesDashboard: !!dashboardData?.sales_dashboard,
    hasChartsData: !!dashboardData?.charts,
    hasSalesDaily: !!dashboardData?.charts?.sales_daily?.length,
    hasTerritoryData: !!dashboardData?.charts?.sales_by_territory?.length,
    hasDivisionData: !!dashboardData?.charts?.sales_by_division?.length,
    hasMetrics: !!dashboardData?.sales_dashboard?.metrics,
    hasTopBrands: !!dashboardData?.sales_dashboard?.top_brands?.length,
    hasTopCustomers: !!dashboardData?.sales_dashboard?.top_customers?.length,
  });

  // Extract sales dashboard data from the main dashboard response
  const salesData = dashboardData?.sales_dashboard;
  const chartsData = dashboardData?.charts;

  const dailySales: SalesChartItem[] = Array.isArray(chartsData?.sales_daily)
    ? (chartsData.sales_daily as SalesChartItem[])
    : [];
  const dailySalesTotal = dailySales.reduce(
    (sum, item) => sum + (Number(item?.value) || 0),
    0
  );

  // Map charts data to sales dashboard format
  const mappedSalesData = salesData
    ? {
        ...salesData,
        // Single source of truth for Net Sales:
        // Overview used sales_dashboard.metrics.totalSales while Trends summed
        // charts.sales_daily — those often disagree (e.g. 8.7M vs 15.5M).
        // Prefer daily chart sum when present (aligns Trends + Executive YTD).
        metrics: (() => {
          const api = salesData.metrics;
          const hasDaily = dailySales.length > 0;
          if (!api && !hasDaily) return null;

          const apiSales = api?.totalSales != null ? Number(api.totalSales) : null;
          const totalSales =
            hasDaily &&
            (apiSales == null ||
              !Number.isFinite(apiSales) ||
              Math.abs(apiSales - dailySalesTotal) / Math.max(dailySalesTotal, 1) >
                0.02)
              ? dailySalesTotal
              : apiSales != null && Number.isFinite(apiSales)
                ? apiSales
                : dailySalesTotal;

          if (
            __DEV__ &&
            hasDaily &&
            apiSales != null &&
            Math.abs(apiSales - dailySalesTotal) > 1
          ) {
            console.log("⚠️ Sales total mismatch — using daily chart sum", {
              metricsTotalSales: apiSales,
              dailyChartSum: dailySalesTotal,
              chosen: totalSales,
              from: params.from_date,
              to: params.to_date,
            });
          }

          const totalInvoices =
            api?.totalInvoices != null
              ? Number(api.totalInvoices)
              : // Never use daily row count as invoice count (that was days, not invoices)
                0;
          const avgInvoiceValue =
            api?.avgInvoiceValue != null && Number(api.avgInvoiceValue) > 0
              ? Number(api.avgInvoiceValue)
              : totalInvoices > 0
                ? totalSales / totalInvoices
                : 0;

          return {
            totalSales,
            totalInvoices,
            avgInvoiceValue,
            costOfGoodsSold: Number(api?.costOfGoodsSold) || 0,
            grossProfit: Number(api?.grossProfit) || 0,
            grossProfitPercentage: Number(api?.grossProfitPercentage) || 0,
          };
        })(),
        // Map territory data - prioritize sales_dashboard data over charts data
        territory:
          salesData.territory ||
          (chartsData?.sales_by_territory as SalesChartItem[] | undefined)?.map((item) => ({
            territory: item.territory,
            total_sales: item.value,
            invoice_count: item.invoice_count || 0,
          })) ||
          [],
        // Map division data - prioritize sales_dashboard data over charts data
        division:
          salesData.division ||
          (chartsData?.sales_by_division?.length
            ? (chartsData.sales_by_division as SalesChartItem[]).map((item) => ({
                division: item.division || item.name,
                total_sales: item.value,
                margin_percentage: item.percentage || 0,
              }))
            : []),
        // Monthly trend from daily sales (same pool as totalSales above)
        monthly_trend: dailySales.length
          ? (() => {
              const monthlyData = dailySales.reduce((acc, item) => {
                const date = new Date(item.date || "");
                const monthKey = `${date.getFullYear()}-${String(
                  date.getMonth() + 1
                ).padStart(2, "0")}`;
                const monthName = date.toLocaleDateString("en-US", {
                  month: "short",
                });

                if (!acc[monthKey]) {
                  acc[monthKey] = {
                    month: monthName,
                    total: 0,
                    count: 0,
                  };
                }
                acc[monthKey].total += Number(item.value) || 0;
                acc[monthKey].count += 1;

                return acc;
              }, {} as Record<string, { month: string; total: number; count: number }>);

              const sortedMonths = Object.keys(monthlyData).sort();
              return {
                labels: sortedMonths.map((key) => monthlyData[key].month),
                current: sortedMonths.map((key) => monthlyData[key].total),
                previous: [] as number[],
              };
            })()
          : salesData.monthly_trend,
      }
    : null;

  // Debug: Log the mapped sales data
  console.log("🔍 Mapped Sales Data:", {
    hasMappedData: !!mappedSalesData,
    hasMetrics: !!mappedSalesData?.metrics,
    hasTerritory: !!mappedSalesData?.territory?.length,
    hasDivision: !!mappedSalesData?.division?.length,
    hasMonthlyTrend: !!mappedSalesData?.monthly_trend?.labels?.length,
    territoryCount: mappedSalesData?.territory?.length || 0,
    divisionCount: mappedSalesData?.division?.length || 0,
    dailySalesCount: chartsData?.sales_daily?.length || 0,
  });

  // Debug: Log detailed data structure
  console.log("🔍 Detailed Mapped Data:", {
    metrics: mappedSalesData?.metrics,
    territory: mappedSalesData?.territory,
    division: mappedSalesData?.division,
    monthlyTrend: mappedSalesData?.monthly_trend,
    chartsDataKeys: chartsData ? Object.keys(chartsData) : [],
    salesByTerritorySample: chartsData?.sales_by_territory?.slice(0, 2),
    salesByDivisionSample: chartsData?.sales_by_division?.slice(0, 2),
  });

  return {
    data: mappedSalesData,
    kpis: dashboardData?.kpis,
    isLoading,
    error,
    refetch,
  };
}
