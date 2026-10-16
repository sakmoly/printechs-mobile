import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { isDemoMode } from "./demoMode";
import { shouldUseMockData } from "./mock";
import {
  getDemoCataloguesList,
  getDemoDashboardData,
  getDemoInventoryHierarchy,
  getDemoInventoryPerformance,
  getDemoInventoryRisk,
  getDemoInventorySnapshot,
  getDemoInventoryTrends,
  getDemoReceivablesPerformance,
  getDemoReceivablesSnapshot,
  getDemoReceivablesTrend,
} from "./demoMocks";
import { isAxiosError } from "axios";
import { z } from "zod";
import { isApiEnabled, isDimensionEnabled } from "./mobileConfig";
import {
  filterBaParams,
  pickBaParams,
  plainJsonClone,
  softParseOrRaw,
} from "./apiResilience";
import { ERP_ANALYSIS } from "./endpoints";
import { logger } from "../utils/logger";
import { isNetworkOrTlsError } from "./serverUrl";
import {
  approveActionErrorMessage,
  parseApproveDocumentResult,
  type ApproveDocumentResult,
} from "../utils/approveResponse";

async function postWithNetworkRetry<T>(
  url: string,
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number; attempts?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await http.post<T>(url, payload, {
        timeout: timeoutMs,
        silentError: attempt < attempts - 1,
      });
    } catch (error) {
      lastError = error;
      const canRetry =
        isNetworkOrTlsError(error) && attempt < attempts - 1;
      if (!canRetry) throw error;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Avoid repeating the same 417 guidance every focus/navigation */
let pushTokenStore417Logged = false;

/** Lenient number — missing/null from other clients → 0 */
const zNum = z.coerce.number().optional().default(0);
const zStr = z.coerce.string().optional().default("");

// ========== SCHEMAS FOR SINGLE API RESPONSES ==========
// All schemas are multi-client safe: optional dims default to empty / "".

const DashboardResponseSchema = z.object({
  kpis: z
    .array(
      z.object({
        id: zStr,
        title: zStr,
        value: zNum,
        change_percentage: zNum,
        change_direction: z
          .enum(["up", "down", "neutral"])
          .optional()
          .default("neutral"),
        currency: z.string().optional(),
        unit: z.string().optional(),
        previous_year_value: z.number().optional(),
      })
    )
    .optional()
    .default([]),
  user_profile: z
    .object({
      image_url: zStr,
      employee_name: zStr,
      company: zStr,
      designation: zStr,
      branch: zStr,
      cell_number: zStr,
      company_email: zStr,
      current_address: zStr,
      country: zStr,
    })
    .optional()
    .default({
      image_url: "",
      employee_name: "",
      company: "",
      designation: "",
      branch: "",
      cell_number: "",
      company_email: "",
      current_address: "",
      country: "",
    }),
  sales_dashboard: z
    .object({
      metrics: z
        .object({
          totalSales: zNum,
          totalInvoices: zNum,
          avgInvoiceValue: zNum,
          costOfGoodsSold: zNum,
          grossProfit: zNum,
          grossProfitPercentage: zNum,
        })
        .nullable()
        .optional(),
      top_brands: z
        .array(
          z.object({
            brand: zStr,
            total_sales: zNum,
            sold_qty: z.number().optional(),
            profit: z.number().optional(),
            total_quantity: z.number().optional(),
            total_cost: z.number().optional(),
            gross_profit_amount: z.number().optional(),
            gross_profit_percent: z.number().optional(),
            invoice_count: z.number().optional(),
          })
        )
        .optional()
        .default([]),
      top_customers: z
        .array(
          z.object({
            customer: zStr,
            customer_name: z.string().optional(),
            total_sales: zNum,
            invoice_count: z.number().optional(),
          })
        )
        .optional()
        .default([]),
      monthly_trend: z
        .object({
          labels: z.array(z.string()).optional(),
          current: z.array(z.number()).optional(),
          previous: z.array(z.number()).optional(),
        })
        .nullable()
        .optional(),
        territory: z
          .array(
            z
              .object({
                territory: zStr,
                total_sales: zNum,
                invoice_count: zNum,
                sales_ly: z.number().optional(),
                value_ly: z.number().optional(),
                previous_year_value: z.number().optional(),
                change_pct: z.number().optional(),
                change_percentage: z.number().optional(),
              })
              .passthrough()
          )
          .optional()
          .default([]),
      division: z
        .array(
          z.object({
            division: zStr,
            total_sales: zNum,
            margin_percentage: zNum,
          })
        )
        .optional()
        .default([]),
    })
    .optional(),
  charts: z
    .object({
      sales_daily: z.array(z.any()).optional(),
      sales_by_territory: z.array(z.any()).optional(),
      sales_by_division: z.array(z.any()).optional(),
    })
    .optional(),
  date: zStr,
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

const EmployeesResponseSchema = z.object({
  employees: z
    .array(
      z.object({
        name: zStr,
        employee_name: zStr,
        designation: zStr,
        department: zStr,
        company: zStr,
        photo_url: zStr,
        image: z.string().optional(),
        company_email: zStr,
        cell_number: zStr,
        branch: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  total_count: zNum,
  departments: z.array(z.string()).optional().default([]),
  designations: z.array(z.string()).optional().default([]),
});

const ApprovalsResponseSchema = z.object({
  approvals: z
    .array(
      z.object({
        id: zStr,
        doctype: zStr,
        name: zStr,
        customer_name: zStr,
        customer: z.string().optional().nullable(),
        total_quantity: zNum,
        total_amount: zNum,
        vat_amount: zNum,
        total_with_vat: zNum,
        status: zStr,
        posting_date: zStr,
        due_date: z.string().optional().nullable(),
        branch: z.string().optional().nullable(),
        territory: z.string().optional(),
        company: z.string().optional().nullable(),
        customer_outstanding: z.number().optional().nullable(),
        customer_overdue: z.number().optional().nullable(),
        outstanding_0_30: z.number().optional().nullable(),
        outstanding_31_60: z.number().optional().nullable(),
        outstanding_61_90: z.number().optional().nullable(),
        outstanding_over_90: z.number().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  total_pending: zNum,
  total_approved: z.number().optional(),
  total_rejected: z.number().optional(),
  sales_invoices: z.number().optional(),
  delivery_notes: z.number().optional(),
  material_requests: z.number().optional(),
  user_territory: z.string().optional(),
});

const UserProfileResponseSchema = z.object({
  user_profile: z.object({
    image_url: zStr,
    employee_name: zStr,
    company: zStr,
    designation: zStr,
    branch: zStr,
    territory: z.string().optional(),
    cell_number: zStr,
    company_email: zStr,
    current_address: zStr,
    country: zStr,
  }),
  qr_data: zStr,
});

const ReceivablesSnapshotResponseSchema = z.object({
  totalUnpaid: zNum,
  totalOverdue: zNum,
  overdueLt400: z.number().optional().default(0),
  oldBalance: z.number().optional().default(0),
  overdue_0_30: zNum,
  overdue_31_60: zNum,
  overdue_61_90: zNum,
  overdue_over_90: zNum,
  overduePercentage: zNum,
  dso: zNum,
  averageCollectionPeriod: zNum,
});

const ReceivablesPerformanceResponseSchema = z.object({
  topOverdueCustomers: z
    .array(
      z.object({
        name: zStr,
        customer: zStr,
        amount: zNum,
      })
    )
    .optional()
    .default([]),
  topOverdueInvoices: z
    .array(
      z.object({
        invoice: zStr,
        customer: zStr,
        amount: zNum,
        days: zNum,
      })
    )
    .optional()
    .default([]),
  agingBreakdown: z
    .array(
      z.object({
        period: zStr,
        amount: zNum,
      })
    )
    .optional()
    .default([]),
  collectionEfficiency: zNum,
});

const ReceivablesTrendResponseSchema = z.object({
  arTrend: z
    .array(z.object({ month: zStr, amount: zNum }))
    .optional()
    .default([]),
  receivableByTerritory: z
    .array(
      z.object({
        territory: zStr,
        amount: zNum,
        percentage: zNum,
      })
    )
    .optional()
    .default([]),
  overdueByTerritory: z
    .array(z.object({ territory: zStr, overdue: zNum }))
    .optional()
    .default([]),
  monthlyOverdueTrend: z
    .array(z.object({ month: zStr, overdue: zNum }))
    .optional()
    .default([]),
  monthlySalesVsCollection: z
    .array(
      z.object({
        month: zStr,
        sales: zNum,
        collection: zNum,
      })
    )
    .optional()
    .default([]),
});

// ========== MULTI-CLIENT HELPERS ==========

function baConfig() {
  return useAuthStore.getState().mobileConfig;
}

/** Skip call when get_mobile_config.apis marks the method false */
function getDisabledFallback<T>(
  methodKey: string,
  fallback: T
): { skip: true; value: T } | { skip: false } {
  if (!isApiEnabled(baConfig(), methodKey)) {
    console.log(`ℹ️ API disabled by site config, skipping: ${methodKey}`);
    return { skip: true, value: fallback };
  }
  return { skip: false };
}

function baParams(
  params?: Record<string, unknown> | null,
  allowed?: string[]
): Record<string, unknown> {
  const cfg = baConfig();
  if (allowed) return pickBaParams(params as any, allowed, cfg);
  return filterBaParams(params as any, cfg);
}

// ========== HELPER FUNCTIONS ==========

// Helper function to generate QR data from user info
const generateQRData = (user: any): string => {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${user.full_name || user.username || "User"}`,
    `ORG:${user.company || ""}`,
    `TITLE:${user.designation || ""}`,
    user.mobile_no || user.phone ? `TEL:${user.mobile_no || user.phone}` : "",
    user.email ? `EMAIL:${user.email}` : "",
    user.location || user.current_address
      ? `ADR:;;${user.location || user.current_address}`
      : "",
    "END:VCARD",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return vcard;
};

// Helper function to generate QR data from employee data
const generateQRDataFromEmployee = (employee: any): string => {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${employee.employee_name || ""}`,
    `ORG:${employee.company || ""}`,
    `TITLE:${employee.designation || ""}`,
    employee.cell_number ? `TEL:${employee.cell_number}` : "",
    employee.company_email ? `EMAIL:${employee.company_email}` : "",
    employee.current_address ? `ADR:;;${employee.current_address}` : "",
    "END:VCARD",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return vcard;
};

// ========== OPTIMIZED API FUNCTIONS ==========

export const optimizedApis = {
  /**
   * Dashboard Screen - Single API call for all dashboard data
   * Returns: KPIs, Charts, User Profile, Sales Dashboard, Date - everything in one response
   */
  async getDashboardData(
    params: {
      company?: string;
      from_date?: string;
      to_date?: string;
      territories?: string;
      territory?: string;
    } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_complete_dashboard_data", {
        kpis: [],
        user_profile: {
          image_url: "",
          employee_name: "",
          company: "",
          designation: "",
          branch: "",
          cell_number: "",
          company_email: "",
          current_address: "",
          country: "",
        },
        date: new Date().toLocaleDateString(),
      } as DashboardData);
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        const u = useAuthStore.getState().user;
        return softParseOrRaw(
          DashboardResponseSchema,
          getDemoDashboardData(u),
          "dashboard:demo"
        );
      }

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Get access token for authentication
      const accessToken = await oauthApi.getValidToken();

      logger.info("Using server URL:", serverUrl);
      logger.info("Using access token for authentication");
      logger.info("Calling Dashboard API with authentication");

      // Try custom API with authentication
      try {
        logger.info(
          "Calling dashboard API with access token authentication"
        );

        const response = await http.get<any>(
          "/api/method/erp_analysis.dashboard.get_complete_dashboard_data",
          baParams(params, [
            "company",
            "from_date",
            "to_date",
            "territories",
            "territory",
          ])
        );

        let apiData: any = response.message ?? response;
        if (typeof apiData === "string") {
          try {
            apiData = JSON.parse(apiData);
          } catch {
            apiData = {};
          }
        }
        if (!apiData || typeof apiData !== "object" || Array.isArray(apiData)) {
          apiData = {};
        }
        apiData = plainJsonClone(apiData);

        // Calculate profit and margin for top_brands if not provided
        if (apiData.sales_dashboard?.top_brands) {
          apiData.sales_dashboard.top_brands =
            apiData.sales_dashboard.top_brands.map((brand: any) => {
              // Calculate profit: total_sales - total_cost
              const profit =
                brand.profit !== undefined
                  ? brand.profit
                  : (brand.total_sales || 0) - (brand.total_cost || 0);

              // Calculate margin percentage: (profit / total_sales) * 100
              const gross_profit_percent =
                brand.gross_profit_percent !== undefined
                  ? brand.gross_profit_percent
                  : brand.total_sales > 0
                  ? (profit / brand.total_sales) * 100
                  : 0;

              return {
                ...brand,
                profit: profit,
                gross_profit_amount: profit, // Use profit for gross_profit_amount
                gross_profit_percent: gross_profit_percent,
                // Map sold_qty to total_quantity for backward compatibility
                total_quantity: brand.sold_qty || brand.total_quantity || 0,
              };
            });
        }

        // Calculate invoice_count for territory data if missing
        if (apiData.sales_dashboard?.territory) {
          apiData.sales_dashboard.territory =
            apiData.sales_dashboard.territory.map((territory: any) => {
              return {
                ...territory,
                // Do not invent invoice counts — keep server value or 0
                invoice_count: territory.invoice_count ?? 0,
              };
            });
        }

        // Debug: Log the actual API response structure before validation
        console.log("🔍 API Response before validation:", {
          hasTopBrands: !!apiData.sales_dashboard?.top_brands?.length,
          hasTopCustomers: !!apiData.sales_dashboard?.top_customers?.length,
          topBrandsSample: apiData.sales_dashboard?.top_brands?.slice(0, 2),
          topCustomersSample: apiData.sales_dashboard?.top_customers?.slice(
            0,
            2
          ),
        });

        const parsed = softParseOrRaw(
          DashboardResponseSchema,
          apiData,
          "dashboard"
        );
        console.log(
          "✅ Custom Dashboard API loaded successfully with real data"
        );
        return plainJsonClone(parsed);
      } catch (customError: any) {
        console.log("⚠️ Custom API failed:", customError);
        console.log("📊 Error details:", {
          message: customError?.message,
          status: customError?.response?.status,
          data: customError?.response?.data,
        });

        // Return mock data as fallback
        return {
          kpis: [
            {
              id: "sales_mtd",
              title: "SALES MTD",
              value: 1983829,
              change_percentage: 15.5,
              change_direction: "up" as const,
              currency: "SAR",
            },
            {
              id: "sales_ytd",
              title: "SALES YTD",
              value: 29949868,
              change_percentage: 35.4,
              change_direction: "up" as const,
              currency: "SAR",
            },
            {
              id: "gross_margin",
              title: "GROSS MARGIN",
              value: 25.8,
              change_percentage: 2.1,
              change_direction: "up" as const,
              unit: "%",
            },
          ],
          charts: {
            sales_daily: [],
            sales_by_territory: [],
            sales_by_division: [],
          },
          user_profile: {
            image_url: "http://printechs.com/files/Sakeer.png",
            employee_name: "Sakeer",
            company: "Printechs",
            designation: "Manager",
            branch: "",
            cell_number: "",
            company_email: "",
            current_address: "",
            country: "",
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
        } as DashboardData;
      }
    } catch (error) {
      console.error("❌ Dashboard API Error:", error);
      throw error;
    }
  },

  // ===== Inventory APIs =====
  async getInventorySnapshot(
    params: {
      company?: string;
      warehouse?: string;
      low_stock_threshold?: number;
    } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_inventory_snapshot", null);
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoInventorySnapshot();
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/erp_analysis.inventory.get_inventory_snapshot",
        baParams(params, ["company", "warehouse", "low_stock_threshold"]),
        { timeout: 120000 }
      );
      return response.message || response;
    } catch (error: unknown) {
      // Silently log network errors - they're handled by the UI
      console.log(
        "⚠️ Inventory Snapshot API Error:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  },

  async getInventoryPerformance(
    params: { company?: string; warehouse?: string; limit?: number } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_inventory_performance", null);
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoInventoryPerformance();
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/erp_analysis.inventory.get_inventory_performance",
        baParams(params, ["company", "warehouse", "limit"])
      );
      return response.message || response;
    } catch (error: unknown) {
      // Silently log network errors - they're handled by the UI
      console.log(
        "⚠️ Inventory Performance API Error:",
        error instanceof Error ? error.message : String(error)
      );

      // Extract error message from response
      let errorMessage = "Failed to load inventory performance data";
      if (isAxiosError(error) && error.response?.status === 417) {
        errorMessage =
          "Inventory Performance API endpoint not found or not whitelisted. Please check backend implementation.";
      } else if (isAxiosError(error) && error.response?.status === 500) {
        errorMessage =
          error.response?.data?.message ||
          error.response?.data?.exc ||
          "Server error occurred";
      } else if (isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  async getInventoryTrends(
    params: {
      company?: string;
      warehouse?: string;
      months?: number;
    } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_inventory_trends", {
        movementInOut: [],
        valueTrend: [],
      });
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoInventoryTrends();
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/erp_analysis.inventory.get_inventory_trends",
        baParams(params, ["company", "warehouse", "months"])
      );
      return response.message || response;
    } catch (error: unknown) {
      // Silently log network errors - they're handled by the UI
      console.log(
        "⚠️ Inventory Trends API Error:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  },

  async getInventoryRisk(
    params: { company?: string; warehouse?: string } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_inventory_risk", {
        lowStock: [],
        overstock: [],
      });
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoInventoryRisk();
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/erp_analysis.inventory.get_inventory_risk",
        baParams(params, ["company", "warehouse"])
      );
      return response.message || response;
    } catch (error: unknown) {
      // Silently log network errors - they're handled by the UI
      console.log(
        "⚠️ Inventory Risk API Error:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  },

  /**
   * Get Inventory Hierarchy Data for Drill-Down Chart
   * Returns data at different levels: category, item_group, brand, item, warehouse
   */
  async getInventoryHierarchy(params: {
    company?: string;
    warehouse?: string;
    /** Territory path root + Category path shared levels */
    level:
      | "territory"
      | "warehouse"
      | "category"
      | "item_group"
      | "brand"
      | "item";
    territory?: string;
    territories?: string;
    category?: string;
    item_group?: string;
    brand?: string;
    item_code?: string;
    limit?: number;
  }) {
    try {
      // Validate required parameters
      if (!params.level) {
        throw new Error("Level parameter is required");
      }

      const disabled = getDisabledFallback("get_inventory_hierarchy", []);
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoInventoryHierarchy();
      }

      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const auth = useAuthStore.getState();
      const company =
        params.company ||
        auth.permissions?.scope?.company ||
        auth.user?.company ||
        undefined;

      // Match BA contract:
      // GET ?level=territory&company=...
      // GET ?level=warehouse&territory=Jeddah&company=...
      // GET ?level=brand&territory=Jeddah&warehouse=Jeddah%20Main%20-%20WHS%20-%20PRNTX&company=...
      const rawHierarchyParams = {
        level: params.level,
        company,
        warehouse: params.warehouse,
        territory: params.territory,
        territories:
          params.territories ??
          (params.territory ? String(params.territory) : undefined),
        category: params.category,
        item_group: params.item_group,
        brand: params.brand,
        item_code: params.item_code,
        limit: params.limit,
      };
      const cleanParams = baParams(rawHierarchyParams, [
        "level",
        "company",
        "warehouse",
        "territory",
        "territories",
        "category",
        "item_group",
        "brand",
        "item_code",
        "limit",
      ]);
      // Stock hierarchy must honor territory even if Desk disabled territory dimension chips elsewhere.
      if (rawHierarchyParams.territory && !cleanParams.territory) {
        cleanParams.territory = rawHierarchyParams.territory;
      }
      if (rawHierarchyParams.territories && !cleanParams.territories) {
        cleanParams.territories = rawHierarchyParams.territories;
      }

      if (__DEV__) {
        console.log("🔍 Inventory Hierarchy API Request:", {
          url: "/api/method/erp_analysis.inventory.get_inventory_hierarchy",
          originalParams: params,
          cleanParams: cleanParams,
          level: cleanParams.level,
          serverUrl,
        });
      }

      const response = await http.get<any>(
        "/api/method/erp_analysis.inventory.get_inventory_hierarchy",
        cleanParams
      );

      const payload = response?.message ?? response;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.message)
            ? payload.message
            : null;

      if (__DEV__) {
        console.log("✅ Inventory Hierarchy API Response:", {
          level: params.level,
          envelope: payload && !Array.isArray(payload) ? Object.keys(payload) : "array",
          dataLength: Array.isArray(rows) ? rows.length : "not array",
          sample: Array.isArray(rows) ? rows.slice(0, 2) : payload,
        });
      }

      // Prefer full envelope { level, rows, meta }; UI normalizes either shape
      return payload;
    } catch (error: any) {
      // Silently log network errors - they're handled by the UI
      if (__DEV__) {
        console.log("⚠️ Inventory Hierarchy API Error:", error.message);
      }

      const serverMsg =
        error.response?.data?._server_messages ||
        error.response?.data?.message ||
        error.response?.data?.exc_type;

      // Extract error message from response
      let errorMessage = "Failed to load inventory hierarchy data";
      if (error.response?.status === 417) {
        if (__DEV__) {
          console.log("⚠️ Hierarchy 417 detail:", serverMsg);
        }
        errorMessage =
          typeof error.response?.data?.message === "string" &&
          error.response.data.message.trim()
            ? error.response.data.message
            : "get_inventory_hierarchy returned 417 (method missing or unexpected kwargs). Confirm BA deployed + restart; params: level, company, territory, warehouse, brand, item_group.";
      } else if (error.response?.status === 500) {
        errorMessage =
          error.response?.data?.message ||
          error.response?.data?.exc ||
          "Server error occurred. Check backend logs.";
      } else if (error.response?.status === 404) {
        errorMessage = "Inventory hierarchy API endpoint not found";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Receivables Dashboard - matches new backend aggregate endpoint
   * Uses GET with query params and defaults report_date to today
   */
  async getReceivablesDashboard(
    params: {
      company?: string;
      report_date?: string; // YYYY-MM-DD; defaults to today
      territory?: string | null;
      party_csv?: string | null;
      old_days?: number; // default 400 on backend
    } = {}
  ) {
    try {
      console.log("🔐 Calling Receivables Dashboard API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      // Defaults
      const user = useAuthStore.getState().user;
      const defaultCompany = params.company || user?.company || "";
      const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
      const defaultReportDate = params.report_date || toIsoDate(new Date());

      // Build query params; add Authorization in query as server accepts it
      const query = {
        Authorization: `Bearer ${accessToken}`,
        company: defaultCompany,
        report_date: defaultReportDate,
        ...(params.territory ? { territory: params.territory } : {}),
        ...(params.party_csv ? { party_csv: params.party_csv } : {}),
        ...(params.old_days ? { old_days: params.old_days } : {}),
      } as any;

      const response = await http.get<any>(
        "/api/method/erp_analysis.receivables.get_receivables_dashboard",
        query
      );

      const apiData = response.message || response;
      console.log("✅ Receivables Dashboard API loaded successfully");
      return apiData;
    } catch (error) {
      console.error("❌ Receivables Dashboard API Error:", error);
      throw error;
    }
  },

  /**
   * Employees Screen - Single API call for all employee data
   * Returns: Employee list, counts, departments, designations - everything in one response
   */
  async getEmployeesData(
    params: {
      department?: string;
      designation?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      console.log("👥 Calling Employees API...");

      // DISABLED: API returns 417 error, using mock data for now
      // TODO: Fix the backend API and re-enable this
      console.log("⚠️ Employees API is temporarily disabled, using mock data");

      // Return mock data directly without calling API
      return {
        employees: [
          {
            name: "EMP-001",
            employee_name: "Sakeer",
            designation: "Sales Manager",
            department: "Sales",
            company: "Printechs",
            photo_url: "http://printechs.com/files/Sakeer.png",
            company_email: "sakeer@printechs.com",
            cell_number: "+966501234567",
            branch: "Main Branch",
          },
          {
            name: "EMP-002",
            employee_name: "Fatima Al-Zahrani",
            designation: "Finance Controller",
            department: "Finance",
            company: "Printechs",
            photo_url:
              "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
            company_email: "fatima.zahrani@printechs.com",
            cell_number: "+966507654321",
            branch: "Main Branch",
          },
          {
            name: "EMP-003",
            employee_name: "Mohammed Al-Mutairi",
            designation: "Operations Manager",
            department: "Operations",
            company: "Printechs",
            photo_url:
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
            company_email: "mohammed.mutairi@printechs.com",
            cell_number: "+966509876543",
            branch: "Main Branch",
          },
        ],
        total_count: 3,
        departments: ["Sales", "Finance", "Operations", "IT", "HR"],
        designations: [
          "Sales Manager",
          "Finance Controller",
          "Operations Manager",
          "IT Manager",
          "HR Manager",
        ],
      } as EmployeesData;

      /* DISABLED API CALL - Re-enable when backend is fixed
      // Try custom API first (no authentication needed - APIs whitelisted)
      try {
        console.log(
          "🌐 Calling employees API without authentication (whitelisted)"
        );

        const response = await http.post<any>(
          "/api/method/erp_analysis.employee.get_complete_employees_data",
          params
        );
        const apiData = response.message || response;
        const parsed = softParseOrRaw(
          EmployeesResponseSchema,
          apiData,
          "employees"
        );
        console.log(
          "✅ Custom Employees API loaded successfully with real data"
        );
        return parsed;
      } catch (customError: any) {
        console.log("⚠️ Custom API failed:", customError);
        console.log("👥 Error details:", {
          message: customError?.message,
          status: customError?.response?.status,
          data: customError?.response?.data,
        });

        // Return mock data as fallback
        return {
          employees: [
            {
              name: "EMP-001",
              employee_name: "Sakeer",
              designation: "Sales Manager",
              department: "Sales",
              company: "Printechs",
              photo_url: "http://printechs.com/files/Sakeer.png",
              company_email: "sakeer@printechs.com",
              cell_number: "+966501234567",
              branch: "Main Branch",
            },
            {
              name: "EMP-002",
              employee_name: "Fatima Al-Zahrani",
              designation: "Finance Controller",
              department: "Finance",
              company: "Printechs",
              photo_url:
                "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
              company_email: "fatima.zahrani@printechs.com",
              cell_number: "+966507654321",
              branch: "Main Branch",
            },
            {
              name: "EMP-003",
              employee_name: "Mohammed Al-Mutairi",
              designation: "Operations Manager",
              department: "Operations",
              company: "Printechs",
              photo_url:
                "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
              company_email: "mohammed.mutairi@printechs.com",
              cell_number: "+966509876543",
              branch: "Main Branch",
            },
          ],
          total_count: 3,
          departments: ["Sales", "Finance", "Operations", "IT", "HR"],
          designations: [
            "Sales Manager",
            "Finance Controller",
            "Operations Manager",
            "IT Manager",
            "HR Manager",
          ],
        } as EmployeesData;
      }
      */
    } catch (error) {
      console.error("❌ Employees API Error:", error);
      throw error;
    }
  },

  /**
   * Approvals Screen - Single API call for all approval data
   * Returns: Approvals list, counts, status - everything in one response
   */
  async getApprovalsData(
    params: {
      status?: string;
      priority?: string;
      limit?: number;
      offset?: number;
      territory?: string; // legacy single-territory parameter
      territories?: string; // new multi-territory parameter (comma separated)
    } = {}
  ) {
    try {
      // Relative path — http client owns the base URL (avoids host+host doubling)
      const apiUrl = ERP_ANALYSIS.approvals.getAllApprovals;

      try {
        // Approvals use approve_territories only (e.g. Dammam), never full view list
        let payload = baParams(params as any, [
          "status",
          "priority",
          "limit",
          "offset",
          "territory",
          "territories",
        ]);
        if (
          !payload.territories &&
          !payload.territory &&
          isDimensionEnabled(baConfig(), "territory")
        ) {
          const scope = useAuthStore.getState().permissions.scope;
          const approveList =
            scope?.approve_territories?.length
              ? scope.approve_territories
              : scope?.branch
                ? [scope.branch]
                : [];
          if (approveList.length > 0) {
            payload = {
              ...payload,
              territories: approveList.join(","),
            };
          }
        }

        const response = await postWithNetworkRetry<any>(apiUrl, payload);

        let apiData = response;

        if (apiData?.message?.message) {
          apiData = apiData.message;
        }

        apiData = apiData?.message || apiData;

        const parsed = softParseOrRaw(
          ApprovalsResponseSchema,
          apiData,
          "approvals"
        );

        logger.debug(
          "Approvals loaded",
          parsed?.approvals?.length || 0,
          "items"
        );
        return parsed;
      } catch (customError: any) {
        const network = isNetworkOrTlsError(customError);
        logger.debug("Custom approvals API failed:", customError?.message);

        if (!shouldUseMockData()) {
          if (network) {
            logger.warn(
              "Approvals API unreachable (network). Showing empty inbox — pull to refresh when online."
            );
          }
          return {
            approvals: [],
            total_pending: 0,
            total_approved: 0,
            total_rejected: 0,
            user_territory:
              params.territories || params.territory || undefined,
          } as ApprovalsData;
        }

        // Demo / mock only — sample documents by territory
        const allApprovals = [
          {
            id: "1",
            doctype: "Sales Invoice",
            name: "SI-00123",
            customer_name: "ACME Corporation",
            customer: "CUST-001",
            total_quantity: 150,
            total_amount: 85000,
            vat_amount: 4250,
            total_with_vat: 89250,
            status: "Draft",
            posting_date: "2025-10-25",
            due_date: "2025-11-25",
            branch: "Riyadh",
            territory: "Central Region", // Assign territory
            company: "Printechs",
            customer_outstanding: 145000,
            customer_overdue: 50000,
            outstanding_0_30: 25000,
            outstanding_31_60: 15000,
            outstanding_61_90: 8000,
            outstanding_over_90: 2000,
          },
          {
            id: "2",
            doctype: "Delivery Note",
            name: "DN-00456",
            customer_name: "Tech Solutions Ltd",
            customer: "CUST-002",
            total_quantity: 85,
            total_amount: 45000,
            vat_amount: 2250,
            total_with_vat: 47250,
            status: "Draft",
            posting_date: "2025-10-24",
            branch: "Jeddah",
            territory: "Western Region", // Assign territory
            company: "Printechs",
            customer_outstanding: 0,
            customer_overdue: 0,
            outstanding_0_30: 0,
            outstanding_31_60: 0,
            outstanding_61_90: 0,
            outstanding_over_90: 0,
          },
          {
            id: "3",
            doctype: "Material Request",
            name: "MR-00789",
            customer_name: "Industrial Supplies Co",
            customer: "CUST-003",
            total_quantity: 200,
            total_amount: 120000,
            vat_amount: 6000,
            total_with_vat: 126000,
            status: "Draft",
            posting_date: "2025-10-23",
            branch: "Dammam",
            territory: "Eastern Region", // Assign territory
            company: "Printechs",
            customer_outstanding: 85000,
            customer_overdue: 20000,
            outstanding_0_30: 30000,
            outstanding_31_60: 25000,
            outstanding_61_90: 20000,
            outstanding_over_90: 10000,
          },
          {
            id: "4",
            doctype: "Sales Invoice",
            name: "SI-00234",
            customer_name: "Retail Group",
            customer: "CUST-004",
            total_quantity: 50,
            total_amount: 25000,
            vat_amount: 1250,
            total_with_vat: 26250,
            status: "Draft",
            posting_date: "2025-10-22",
            due_date: "2025-11-22",
            branch: "Riyadh",
            territory: "Central Region", // Assign territory
            company: "Printechs",
            customer_outstanding: 0,
            customer_overdue: 0,
            outstanding_0_30: 0,
            outstanding_31_60: 0,
            outstanding_61_90: 0,
            outstanding_over_90: 0,
          },
        ];

        // Filter by territory if provided in params
        const filteredApprovals = params.territory
          ? allApprovals.filter((app) => app.territory === params.territory)
          : allApprovals;

        return {
          approvals: filteredApprovals,
          total_pending: filteredApprovals.length,
          total_approved: 0,
          total_rejected: 0,
          user_territory: params.territory || "Central Region", // Return user's territory
        } as ApprovalsData;
      }
    } catch (error) {
      console.error("❌ Approvals API Error:", error);
      throw error;
    }
  },

  /**
   * Approve a document
   * Returns: Success status
   */
  async approveDocument(
    doctype: string,
    name: string,
    comment?: string
  ): Promise<ApproveDocumentResult> {
    try {
      if (shouldUseMockData()) {
        console.log("✅ Demo: simulate approve", { doctype, name });
        return { status: "success" };
      }

      logger.debug("Approving document", { doctype, name });

      const approveUrl = ERP_ANALYSIS.approvals.approveDocument;

      try {
        const response = await postWithNetworkRetry<any>(
          approveUrl,
          { doctype, name, comment },
          { timeoutMs: 120_000, attempts: 2 }
        );

        const raw = response?.message ?? response;
        const parsed = parseApproveDocumentResult(raw);
        if (
          parsed.status &&
          parsed.status !== "success" &&
          parsed.status !== "ok"
        ) {
          throw new Error(
            typeof raw === "object" && raw && "message" in (raw as object)
              ? String((raw as { message?: string }).message || parsed.status)
              : `Approve failed (${parsed.status})`
          );
        }
        logger.debug("Document approved", parsed);
        return parsed;
      } catch (customError: any) {
        logger.debug("Approve API failed", {
          status: customError?.response?.status,
        });

        // Extract detailed error message from ERPNext response
        let errorMessage = "Failed to approve document. Please try again.";
        let serverMessages: string[] = [];

        // ERPNext usually returns error in this format
        if (customError?.response?.data) {
          const errorData = customError.response.data;

          // Parse _server_messages if available (contains JSON strings)
          if (errorData._server_messages) {
            try {
              const serverMessagesStr = errorData._server_messages;
              if (typeof serverMessagesStr === 'string') {
                // Parse JSON array of message objects
                const parsed = JSON.parse(serverMessagesStr);
                if (Array.isArray(parsed)) {
                  serverMessages = parsed.map((msg: any) => {
                    if (typeof msg === 'string') {
                      try {
                        const msgObj = JSON.parse(msg);
                        return msgObj.message || msg;
                      } catch {
                        return msg;
                      }
                    } else if (msg && typeof msg === 'object') {
                      return msg.message || JSON.stringify(msg);
                    }
                    return String(msg);
                  });
                }
              }
            } catch (e) {
              console.log("⚠️ Could not parse _server_messages:", e);
            }
          }

          // Check for different error formats
          if (errorData.message) {
            // Handle nested message structure
            const msg = Array.isArray(errorData.message) 
              ? errorData.message[0] 
              : errorData.message;
            
            // Extract permission error from traceback if present
            if (typeof msg === "string" && msg.includes("PermissionError")) {
              const permMatch = msg.match(/PermissionError:\s*(.+?)(?:\n|$)/);
              if (permMatch) {
                errorMessage = permMatch[1].trim();
              } else if (msg.includes("do not have approval access")) {
                const docMatch = msg.match(/You do not have approval access for (.+?)\./);
                errorMessage = docMatch 
                  ? `You do not have permission to approve ${docMatch[1]}.`
                  : "You do not have permission to approve this document.";
              } else {
                errorMessage = msg;
              }
            } else {
              errorMessage = typeof msg === "string" ? msg : JSON.stringify(msg);
            }
          } else if (errorData.exc) {
            // ERPNext exception - extract the actual error message
            const excStr = Array.isArray(errorData.exc) 
              ? errorData.exc.join("\n") 
              : errorData.exc;
            
            // Extract PermissionError specifically
            const permMatch = excStr.match(/PermissionError:\s*(.+?)(?:\n|$)/);
            if (permMatch) {
              errorMessage = permMatch[1].trim();
            } else if (excStr.includes("do not have approval access")) {
              const docMatch = excStr.match(/You do not have approval access for (.+?)\./);
              errorMessage = docMatch 
                ? `You do not have permission to approve ${docMatch[1]}.`
                : "You do not have permission to approve this document.";
            } else if (excStr.includes("TimestampMismatchError")) {
              errorMessage = "Document was modified by another user. The backend should retry automatically. Please try again.";
            } else {
              // Try to extract last line of traceback (usually the error message)
              const lines = excStr
                .split("\n")
                .filter((line: string) => line.trim());
              const lastLine = lines[lines.length - 1];
              if (lastLine && !lastLine.includes("Traceback") && !lastLine.includes("File")) {
                errorMessage = lastLine.replace(/^.*?: /, "").trim();
              } else {
                errorMessage = excStr;
              }
            }
          } else if (errorData.exc_type) {
            if (errorData.exc_type === "PermissionError" || errorData.exc_type.includes("Permission")) {
              errorMessage = errorData.exc_message || "You do not have permission to perform this action.";
            } else if (errorData.exc_type === "TimestampMismatchError") {
              errorMessage = "Document was modified by another user. Please refresh and try again.";
            } else {
              errorMessage = errorData.exc_message || errorData.exc_type;
            }
          } else if (typeof errorData === "string") {
            errorMessage = errorData;
          }
        } else if (customError?.message) {
          errorMessage = customError.message;
        }

        // Prioritize server messages if available (they contain validation errors)
        if (serverMessages.length > 0) {
          // Filter out TimestampMismatchError if there's a more important error (like CR validation)
          const nonTimestampErrors = serverMessages.filter(msg => 
            !msg.toLowerCase().includes("timestamp") && 
            !msg.toLowerCase().includes("modified after you have opened")
          );
          
          if (nonTimestampErrors.length > 0) {
            // Use the first non-timestamp error (usually validation error)
            errorMessage = nonTimestampErrors[0];
          } else {
            // Only timestamp error, use it
            errorMessage = serverMessages[0];
          }
        }

        // Clean up error message
        if (errorMessage.includes("You do not have approval access")) {
          const docMatch = errorMessage.match(/You do not have approval access for (.+?)\./);
          errorMessage = docMatch 
            ? `You do not have permission to approve ${docMatch[1]}.`
            : "You do not have permission to approve this document.";
        } else if (errorMessage.includes("TimestampMismatchError") || errorMessage.includes("modified after you have opened")) {
          errorMessage = "Document was modified by another user. Please refresh and try again, or the backend will retry automatically.";
        } else if (errorMessage.includes("Commercial Registration") || errorMessage.includes("CR")) {
          // Keep the CR validation error as-is - it's clear and actionable
          // Do nothing, error message already contains the validation message
        }

        if (isNetworkOrTlsError(customError)) {
          errorMessage = approveActionErrorMessage(customError, "approve");
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      if (isNetworkOrTlsError(error)) {
        throw new Error(approveActionErrorMessage(error, "approve"));
      }
      throw error;
    }
  },

  /**
   * Reject a document
   * Returns: Success status
   */
  async rejectDocument(doctype: string, name: string, reason?: string) {
    try {
      if (shouldUseMockData()) {
        console.log("✅ Demo: simulate reject", { doctype, name });
        return { success: true, message: "Demo mode: rejection simulated." };
      }

      logger.debug("Rejecting document", { doctype, name });

      const rejectUrl = ERP_ANALYSIS.approvals.rejectDocument;

      try {
        const response = await postWithNetworkRetry<any>(
          rejectUrl,
          { doctype, name, reason },
          { timeoutMs: 120_000, attempts: 2 }
        );

        logger.debug("Document rejected");
        return response.message || response;
      } catch (customError: any) {
        logger.debug("Reject API failed", {
          status: customError?.response?.status,
        });

        // Extract detailed error message from ERPNext response
        let errorMessage = "Failed to reject document. Please try again.";

        // ERPNext usually returns error in this format
        if (customError?.response?.data) {
          const errorData = customError.response.data;

          // Check for different error formats
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.exc) {
            // ERPNext exception - extract the actual error message
            const excMatch = errorData.exc.match(
              /Traceback.*?\n(.*?)(?:\n|$)/s
            );
            if (excMatch) {
              errorMessage = excMatch[1].trim();
            } else {
              errorMessage = errorData.exc;
            }
          } else if (errorData.exc_type) {
            errorMessage = errorData.exc_message || errorData.exc_type;
          } else if (typeof errorData === "string") {
            errorMessage = errorData;
          }
        } else if (customError?.message) {
          errorMessage = customError.message;
        }

        if (isNetworkOrTlsError(customError)) {
          errorMessage = approveActionErrorMessage(customError, "reject");
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      if (isNetworkOrTlsError(error)) {
        throw new Error(approveActionErrorMessage(error, "reject"));
      }
      throw error;
    }
  },

  /**
   * User Profile Screen - Single API call for all user profile data
   * Returns: User info, employee info, QR data - everything in one response
   */
  async getUserProfileData() {
    try {
      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Get current logged-in user from auth store
      const currentUser = useAuthStore.getState().user;
      console.log("👤 Current logged-in user:", currentUser);

      if (!currentUser) {
        throw new Error("No user is currently logged in");
      }

      const fallbackProfile = {
        image_url: "",
        employee_name:
          currentUser.full_name || currentUser.username || "User",
        company: currentUser.company || "",
        designation: currentUser.designation || "",
        branch: (currentUser as any).branch || "",
        territory: (currentUser as any).branch || "",
        cell_number:
          (currentUser as any).mobile_no ||
          (currentUser as any).phone ||
          "",
        company_email: currentUser.email || "",
        current_address: (currentUser as any).current_address || "",
        country: (currentUser as any).country || "",
      };

      let apiData: any;
      try {
        await oauthApi.ensureValidToken();
        const response = await http.get<any>(
          ERP_ANALYSIS.employee.getEmployeeProfile,
          baParams({ email: currentUser.email }, ["email"]),
          { silentError: true }
        );
        apiData = response.message || response;
      } catch (profileError) {
        const st = (profileError as { response?: { status?: number } })
          ?.response?.status;
        if (st === 401 || st === 403) {
          logger.debug(
            "get_employee_profile auth failed — using login profile fallback"
          );
        } else {
          logger.warn(
            "get_employee_profile unavailable, using login profile",
            profileError
          );
        }
        const payload = {
          user_profile: fallbackProfile,
          qr_data: generateQRDataFromEmployee(fallbackProfile as any),
        };
        return softParseOrRaw(
          UserProfileResponseSchema,
          payload,
          "user_profile"
        ) as UserProfileData;
      }

      // Defensive: ensure the profile belongs to the current login
      const returnedEmail = (apiData?.user_profile?.company_email || "")
        .trim()
        .toLowerCase();
      const loginEmail = (currentUser.email || "").trim().toLowerCase();
      const belongsToLogin = !!loginEmail && returnedEmail === loginEmail;

      // If mismatch, return minimal profile for the logged-in user (forces logo + username)
      const safeProfile = belongsToLogin
        ? apiData.user_profile
        : fallbackProfile;

      // Build a compliant payload by adding qr_data (backend doesn't return it)
      const payload = {
        user_profile: safeProfile,
        qr_data: generateQRDataFromEmployee(safeProfile as any),
      };

      const parsed = softParseOrRaw(
        UserProfileResponseSchema,
        payload,
        "user_profile"
      );
      return parsed as UserProfileData;
    } catch (error) {
      console.error("❌ User Profile API Error:", error);
      throw error;
    }
  },

  /**
   * Send Statement of Account via Email
   * Returns: Success message
   */
  async sendStatementByEmail(
    customerInput: string,
    opts?: { company?: string }
  ) {
    if (shouldUseMockData()) {
      return { success: true, message: "Demo mode: email not sent." };
    }
    const { sendCustomerStatementEmail } = await import("./customerStatement");
    try {
      return await sendCustomerStatementEmail({
        customer: customerInput,
        company: opts?.company,
      });
    } catch (error) {
      console.warn("⚠️ Send statement email failed:", (error as Error)?.message);
      throw error;
    }
  },

  /**
   * Receivables Snapshot API
   * Returns: Total unpaid, total overdue, overdue breakdown, DSO, and collection metrics
   */
  async getReceivablesSnapshot(
    params: { company?: string; territory?: string } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_receivables_snapshot", {
        totalUnpaid: 0,
        totalOverdue: 0,
        overdueLt400: 0,
        oldBalance: 0,
        overdue_0_30: 0,
        overdue_31_60: 0,
        overdue_61_90: 0,
        overdue_over_90: 0,
        overduePercentage: 0,
        dso: 0,
        averageCollectionPeriod: 0,
      });
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoReceivablesSnapshot();
      }
      console.log("🔐 Calling Receivables Snapshot API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      logger.info(
        "Valid access token obtained for Receivables Snapshot API"
      );

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/erp_analysis.receivables.get_receivables_snapshot",
        baParams(params, ["company", "territory"])
      );

      const apiData = response.message || response;
      // Backward compatibility defaults for servers that don't return these fields yet
      const normalized = {
        overdueLt400: 0,
        oldBalance: 0,
        ...apiData,
      };
      const parsed = softParseOrRaw(
        ReceivablesSnapshotResponseSchema,
        normalized,
        "receivables_snapshot"
      );
      console.log("✅ Receivables Snapshot API loaded successfully");
      return parsed;
    } catch (error) {
      console.error("❌ Receivables Snapshot API Error:", error);
      throw error;
    }
  },

  /**
   * Receivables Performance API
   * Returns: Top overdue customers, invoices, aging breakdown, and collection efficiency
   */
  async getReceivablesPerformance(
    params: { company?: string; territory?: string; limit?: number } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_receivables_performance", {
        topOverdueCustomers: [],
        topOverdueInvoices: [],
        agingBreakdown: [],
        collectionEfficiency: 0,
      });
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoReceivablesPerformance();
      }
      console.log("🔐 Calling Receivables Performance API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      logger.info(
        "Valid access token obtained for Receivables Performance API"
      );

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/erp_analysis.receivables.get_receivables_performance",
        baParams(params, ["company", "territory", "limit"])
      );

      const apiData = response.message || response;
      const parsed = softParseOrRaw(
        ReceivablesPerformanceResponseSchema,
        apiData,
        "receivables_performance"
      );
      console.log("✅ Receivables Performance API loaded successfully");
      return parsed;
    } catch (error) {
      console.error("❌ Receivables Performance API Error:", error);
      throw error;
    }
  },

  /**
   * Receivables Trend API
   * Returns: AR trends, territory breakdown, overdue trends, and sales vs collection
   */
  async getReceivablesTrend(
    params: { company?: string; territory?: string; months?: number } = {}
  ) {
    try {
      const disabled = getDisabledFallback("get_receivables_trends", {
        arTrend: [],
        receivableByTerritory: [],
        overdueByTerritory: [],
        monthlyOverdueTrend: [],
        monthlySalesVsCollection: [],
      });
      if (disabled.skip) return disabled.value;

      if (shouldUseMockData()) {
        return getDemoReceivablesTrend();
      }
      console.log("🔐 Calling Receivables Trend API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      logger.info("Valid access token obtained for Receivables Trend API");

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/erp_analysis.receivables.get_receivables_trends",
        baParams(params, ["company", "territory", "months"])
      );

      const apiData = response.message || response;
      const parsed = softParseOrRaw(
        ReceivablesTrendResponseSchema,
        apiData,
        "receivables_trend"
      );
      console.log("✅ Receivables Trend API loaded successfully");
      return parsed;
    } catch (error) {
      console.error("❌ Receivables Trend API Error:", error);
      throw error;
    }
  },

  async getTerritoryReceivables(params: {
    company?: string;
    territory: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }) {
    try {
      const disabled = getDisabledFallback("get_territory_receivables", {
        customers: [],
        total: 0,
      });
      if (disabled.skip) return disabled.value;

      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const response = await http.get<any>(
        "/api/method/erp_analysis.receivables.get_territory_receivables",
        baParams(params as any, [
          "company",
          "territory",
          "limit",
          "offset",
          "sort",
        ])
      );
      return response.message || response;
    } catch (error) {
      console.error("❌ Territory Receivables API Error:", error);
      throw error;
    }
  },

  async getCustomerStatement(params: {
    company?: string;
    customer: string;
    from_date?: string;
    to_date?: string;
  }) {
    const disabled = getDisabledFallback("get_customer_statement", null);
    if (disabled.skip) return disabled.value;

    const { fetchCustomerStatement } = await import("./customerStatement");
    try {
      return await fetchCustomerStatement(params);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 403) {
        console.warn(
          "⚠️ Customer statement unavailable (403) — check Access Profile for receivables statement"
        );
      } else {
        console.warn("⚠️ Customer statement failed:", (error as Error)?.message);
      }
      throw error;
    }
  },

  /**
   * Get list of all available catalogues
   */
  async getCataloguesList() {
    try {
      if (shouldUseMockData()) {
        return getDemoCataloguesList();
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const apiUrl = "/api/method/erp_analysis.catalogue.get_catalogues_list";
      logger.info("Fetching catalogues list from:", serverUrl);
      logger.info("API Endpoint:", apiUrl);
      logger.info("Access token:", accessToken ? "Present" : "Missing");
      
      const response = await http.get<any>(apiUrl);
      
      logger.info("Raw catalogues API response TYPE:", typeof response);
      logger.info("Raw catalogues API response:", response);
      logger.info("Response has 'message'?", !!response?.message);
      logger.info("Response has 'catalogues'?", !!response?.catalogues);
      logger.info("Response keys:", Object.keys(response || {}));
      
      // Handle various response structures:
      // 1. { message: { catalogues: [...], total: N } }
      // 2. { message: { message: { catalogues: [...], total: N } } }
      // 3. { catalogues: [...], total: N }
      let data = response;
      
      // Extract message if present
      if (response?.message) {
        data = response.message;
        // Check for double-nesting
        if (data?.message) {
          data = data.message;
        }
      }
      
      console.log("🔍 Processed catalogues data:", JSON.stringify(data, null, 2));
      
      // Ensure we have the expected structure
      if (!data.catalogues && Array.isArray(data)) {
        // If data is directly an array, wrap it
        data = { catalogues: data, total: data.length };
      }
      
      // Validate structure
      if (!data.catalogues) {
        console.warn("⚠️ Unexpected response structure. Expected 'catalogues' field.");
        console.warn("⚠️ Response keys:", Object.keys(data));
        data = { catalogues: [], total: 0 };
      }
      
      const catalogues = Array.isArray(data.catalogues) ? data.catalogues : [];
      console.log("🔍 Catalogues count:", catalogues.length);
      console.log("🔍 Total from API:", data.total);
      
      if (catalogues.length > 0) {
        console.log("🔍 First catalogue:", JSON.stringify(catalogues[0], null, 2));
        console.log("🔍 First catalogue keys:", Object.keys(catalogues[0]));
        console.log("🔍 First catalogue youtube_video_url:", catalogues[0].youtube_video_url);
        console.log("🔍 First catalogue videos array:", catalogues[0].videos);
        console.log("🔍 First catalogue video count:", catalogues[0].videos?.length || 0);
      } else {
        console.warn("⚠️ No catalogues returned from API");
      }
      
      return { catalogues, total: data.total || catalogues.length };
    } catch (error: any) {
      console.error("❌ Catalogues List API Error:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Return empty structure instead of throwing to prevent app crash
      return { catalogues: [], total: 0 };
    }
  },

  /**
   * Get pages for a specific catalogue (from PDF)
   */
  async getCataloguePages(catalogueId: string) {
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const response = await http.get<any>(
        "/api/method/erp_analysis.catalogue.get_catalogue_pages",
        { catalogue_id: catalogueId }
      );
      
      // Handle double-nested message structure
      let data = response.message || response;
      if (data?.message) {
        data = data.message;
      }
      
      return data;
    } catch (error) {
      console.error("❌ Catalogue Pages API Error:", error);
      throw error;
    }
  },

  /**
   * Store Expo push token for notifications
   */
  async storePushToken(params: {
    expoToken: string;
    platform?: string;
    territory?: string | null;
    company?: string | null;
  }) {
    try {
      if (isDemoMode()) {
        logger.info("Demo mode: skip registering push token with server");
        return;
      }
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      const payload = {
        expo_token: params.expoToken,
        platform: params.platform || "unknown",
        territory: params.territory,
        company: params.company,
      };

      await http.post(
        "/api/method/erp_analysis.api.store_push_token",
        payload
      );
      logger.info("Push token stored with backend");
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 417) {
        if (!pushTokenStore417Logged) {
          pushTokenStore417Logged = true;
          logger.info(
            "Push token not accepted (HTTP 417). On the Frappe site, allow POST for " +
              "`erp_analysis.api.store_push_token` (whitelisted server method), " +
              "or align the app with the method name your `erp_analysis` app exposes."
          );
        }
        return;
      }
      logger.error("Store Push Token Error:", error);
      throw error;
    }
  },
};

// ========== TYPE EXPORTS ==========
export type DashboardData = z.infer<typeof DashboardResponseSchema>;
export type EmployeesData = z.infer<typeof EmployeesResponseSchema>;
export type ApprovalsData = z.infer<typeof ApprovalsResponseSchema>;
export type UserProfileData = z.infer<typeof UserProfileResponseSchema>;
export type ReceivablesSnapshotData = z.infer<
  typeof ReceivablesSnapshotResponseSchema
>;
export type ReceivablesPerformanceData = z.infer<
  typeof ReceivablesPerformanceResponseSchema
>;
export type ReceivablesTrendData = z.infer<
  typeof ReceivablesTrendResponseSchema
>;
