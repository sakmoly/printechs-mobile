import { http } from "./http";
import { useAuthStore } from "../store/auth";
import { oauthApi } from "./oauth";
import { z } from "zod";

// ========== SCHEMAS FOR SINGLE API RESPONSES ==========

// Dashboard Screen - Single API Response Schema
const DashboardResponseSchema = z.object({
  kpis: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      value: z.number(),
      change_percentage: z.number(),
      change_direction: z.enum(["up", "down", "neutral"]),
      currency: z.string().optional(),
      unit: z.string().optional(),
      previous_year_value: z.number().optional(), // Add previous year value
    })
  ),
  user_profile: z.object({
    image_url: z.string(),
    employee_name: z.string(),
    company: z.string(),
    designation: z.string(),
    branch: z.string(),
    cell_number: z.string(),
    company_email: z.string(),
    current_address: z.string(),
    country: z.string(),
  }),
  sales_dashboard: z
    .object({
      metrics: z
        .object({
          totalSales: z.number(),
          totalInvoices: z.number(),
          avgInvoiceValue: z.number(),
          costOfGoodsSold: z.number(),
          grossProfit: z.number(),
          grossProfitPercentage: z.number(),
        })
        .nullable()
        .optional(),
      top_brands: z
        .array(
          z.object({
            brand: z.string(),
            total_sales: z.number(),
            sold_qty: z.number().optional(), // SUM(sold_qty) from backend
            profit: z.number().optional(), // Profit amount from backend
            total_quantity: z.number().optional(),
            total_cost: z.number().optional(),
            gross_profit_amount: z.number().optional(),
            gross_profit_percent: z.number().optional(),
            invoice_count: z.number().optional(),
          })
        )
        .optional(),
      top_customers: z
        .array(
          z.object({
            customer: z.string(),
            customer_name: z.string().optional(),
            total_sales: z.number(),
            invoice_count: z.number().optional(),
          })
        )
        .optional(),
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
          z.object({
            territory: z.string(),
            total_sales: z.number(),
            invoice_count: z.number(),
          })
        )
        .optional(),
      division: z
        .array(
          z.object({
            division: z.string(),
            total_sales: z.number(),
            margin_percentage: z.number(),
          })
        )
        .optional(),
    })
    .optional(),
  charts: z
    .object({
      sales_daily: z.array(z.any()).optional(),
      sales_by_territory: z.array(z.any()).optional(),
      sales_by_division: z.array(z.any()).optional(),
    })
    .optional(),
  date: z.string(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

// Employees Screen - Single API Response Schema
const EmployeesResponseSchema = z.object({
  employees: z.array(
    z.object({
      name: z.string(),
      employee_name: z.string(),
      designation: z.string(),
      department: z.string(),
      company: z.string(),
      photo_url: z.string(),
      company_email: z.string(),
      cell_number: z.string(),
      branch: z.string().optional(),
    })
  ),
  total_count: z.number(),
  departments: z.array(z.string()),
  designations: z.array(z.string()),
});

// Approvals Screen - Single API Response Schema
const ApprovalsResponseSchema = z.object({
  approvals: z.array(
    z.object({
      id: z.string(),
      doctype: z.string(), // Sales Invoice, Delivery Note, Material Request
      name: z.string(), // Document name/number
      customer_name: z.string(),
      customer: z.string().optional().nullable(),
      total_quantity: z.number(),
      total_amount: z.number(), // Amount without VAT
      vat_amount: z.number(),
      total_with_vat: z.number(), // Amount with VAT
      status: z.string(),
      posting_date: z.string(),
      due_date: z.string().optional().nullable(),
      branch: z.string().optional().nullable(),
      territory: z.string().optional(), // Territory/Region for filtering
      company: z.string().optional().nullable(),
      // Customer credit information
      customer_outstanding: z.number().optional().nullable(), // Total outstanding amount
      customer_overdue: z.number().optional().nullable(), // Overdue amount
      // Aging buckets
      outstanding_0_30: z.number().optional().nullable(), // Outstanding 0-30 days
      outstanding_31_60: z.number().optional().nullable(), // Outstanding 31-60 days
      outstanding_61_90: z.number().optional().nullable(), // Outstanding 61-90 days
      outstanding_over_90: z.number().optional().nullable(), // Outstanding over 90 days
    })
  ),
  total_pending: z.number(),
  total_approved: z.number().optional(), // Make optional since API doesn't always include
  total_rejected: z.number().optional(), // Make optional since API doesn't always include
  sales_invoices: z.number().optional(), // Additional field from API
  delivery_notes: z.number().optional(), // Additional field from API
  material_requests: z.number().optional(), // Additional field from API
  user_territory: z.string().optional(), // Territory of the logged-in user
});

// User Profile Screen - Single API Response Schema
const UserProfileResponseSchema = z.object({
  user_profile: z.object({
    image_url: z.string(),
    employee_name: z.string(),
    company: z.string(),
    designation: z.string(),
    branch: z.string(),
    territory: z.string().optional(), // Add territory field for approval filtering
    cell_number: z.string(),
    company_email: z.string(),
    current_address: z.string(),
    country: z.string(),
  }),
  qr_data: z.string(), // Pre-generated vCard data
});

// Receivables Snapshot Schema
const ReceivablesSnapshotResponseSchema = z.object({
  totalUnpaid: z.number(),
  totalOverdue: z.number(),
  overdueLt400: z.number().optional().default(0),
  oldBalance: z.number().optional().default(0),
  overdue_0_30: z.number(),
  overdue_31_60: z.number(),
  overdue_61_90: z.number(),
  overdue_over_90: z.number(),
  overduePercentage: z.number(),
  dso: z.number(),
  averageCollectionPeriod: z.number(),
});

// Receivables Performance Schema
const ReceivablesPerformanceResponseSchema = z.object({
  topOverdueCustomers: z.array(
    z.object({
      name: z.string(),
      customer: z.string(),
      amount: z.number(),
    })
  ),
  topOverdueInvoices: z.array(
    z.object({
      invoice: z.string(),
      customer: z.string(),
      amount: z.number(),
      days: z.number(),
    })
  ),
  agingBreakdown: z.array(
    z.object({
      period: z.string(),
      amount: z.number(),
    })
  ),
  collectionEfficiency: z.number(),
});

const ReceivablesTrendResponseSchema = z.object({
  arTrend: z.array(
    z.object({
      month: z.string(),
      amount: z.number(),
    })
  ),
  receivableByTerritory: z.array(
    z.object({
      territory: z.string(),
      amount: z.number(),
      percentage: z.number(),
    })
  ),
  overdueByTerritory: z.array(
    z.object({
      territory: z.string(),
      overdue: z.number(),
    })
  ),
  monthlyOverdueTrend: z.array(
    z.object({
      month: z.string(),
      overdue: z.number(),
    })
  ),
  monthlySalesVsCollection: z.array(
    z.object({
      month: z.string(),
      sales: z.number(),
      collection: z.number(),
    })
  ),
});

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
    } = {}
  ) {
    try {
      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Get access token for authentication
      const accessToken = await oauthApi.getValidToken();

      console.log("🌐 Using server URL:", serverUrl);
      console.log("🔑 Using access token for authentication");
      console.log("📊 Calling Dashboard API with authentication");

      // Try custom API with authentication
      try {
        console.log(
          "🌐 Calling dashboard API with access token authentication"
        );

        const response = await http.get<any>(
          "/api/method/printechs_utility.dashboard.get_complete_dashboard_data",
          params
        );

        const apiData = response.message || response;

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
              // If invoice_count is missing or 0, estimate from sales
              // Assuming average invoice value of ~1000 SAR per invoice
              const estimatedInvoiceCount =
                territory.invoice_count ||
                Math.round(territory.total_sales / 1000);

              return {
                ...territory,
                invoice_count: estimatedInvoiceCount || 0,
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

        const parsed = DashboardResponseSchema.parse(apiData);
        console.log(
          "✅ Custom Dashboard API loaded successfully with real data"
        );
        return parsed;
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
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/printechs_utility.inventory.get_inventory_snapshot",
        params
      );
      return response.message || response;
    } catch (error) {
      // Silently log network errors - they're handled by the UI
      console.log("⚠️ Inventory Snapshot API Error:", error.message);
      throw error;
    }
  },

  async getInventoryPerformance(
    params: { company?: string; warehouse?: string; limit?: number } = {}
  ) {
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/printechs_utility.inventory.get_inventory_performance",
        params
      );
      return response.message || response;
    } catch (error) {
      // Silently log network errors - they're handled by the UI
      console.log("⚠️ Inventory Performance API Error:", error.message);

      // Extract error message from response
      let errorMessage = "Failed to load inventory performance data";
      if (error.response?.status === 417) {
        errorMessage =
          "Inventory Performance API endpoint not found or not whitelisted. Please check backend implementation.";
      } else if (error.response?.status === 500) {
        errorMessage =
          error.response?.data?.message ||
          error.response?.data?.exc ||
          "Server error occurred";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      throw error;
    }
  },

  async getInventoryTrends(
    params: {
      company?: string;
      warehouse?: string;
      months?: number;
      from_date?: string;
      to_date?: string;
    } = {}
  ) {
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/printechs_utility.inventory.get_inventory_trends",
        params
      );
      return response.message || response;
    } catch (error) {
      // Silently log network errors - they're handled by the UI
      console.log("⚠️ Inventory Trends API Error:", error.message);
      throw error;
    }
  },

  async getInventoryRisk(
    params: { company?: string; warehouse?: string } = {}
  ) {
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");
      const response = await http.get<any>(
        "/api/method/printechs_utility.inventory.get_inventory_risk",
        params
      );
      return response.message || response;
    } catch (error) {
      // Silently log network errors - they're handled by the UI
      console.log("⚠️ Inventory Risk API Error:", error.message);
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
    level: "category" | "item_group" | "brand" | "item" | "warehouse";
    category?: string;
    item_group?: string;
    brand?: string;
    item_code?: string;
  }) {
    try {
      // Validate required parameters
      if (!params.level) {
        throw new Error("Level parameter is required");
      }

      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      // Filter out empty, null, or undefined values to prevent backend validation errors
      const cleanParams: any = {
        level: params.level,
      };

      // Only include non-empty values
      if (params.company && params.company.trim()) {
        cleanParams.company = params.company;
      }
      if (params.warehouse && params.warehouse.trim()) {
        cleanParams.warehouse = params.warehouse;
      }
      if (params.category && params.category.trim()) {
        cleanParams.category = params.category;
      }
      if (params.item_group && params.item_group.trim()) {
        cleanParams.item_group = params.item_group;
      }
      if (params.brand && params.brand.trim()) {
        cleanParams.brand = params.brand;
      }
      if (params.item_code && params.item_code.trim()) {
        cleanParams.item_code = params.item_code;
      }

      // Log request details for debugging
      console.log("🔍 Inventory Hierarchy API Request:", {
        url: "/api/method/printechs_utility.inventory.get_inventory_hierarchy",
        originalParams: params,
        cleanParams: cleanParams,
        level: cleanParams.level,
        serverUrl,
      });

      const response = await http.get<any>(
        "/api/method/printechs_utility.inventory.get_inventory_hierarchy",
        cleanParams
      );

      console.log("✅ Inventory Hierarchy API Response:", {
        level: params.level,
        dataLength: Array.isArray(response.message || response)
          ? (response.message || response).length
          : "not array",
        sample: Array.isArray(response.message || response)
          ? (response.message || response).slice(0, 2)
          : response.message || response,
      });

      return response.message || response;
    } catch (error: any) {
      // Silently log network errors - they're handled by the UI
      console.log("⚠️ Inventory Hierarchy API Error:", error.message);

      // Extract error message from response
      let errorMessage = "Failed to load inventory hierarchy data";
      if (error.response?.status === 417) {
        errorMessage =
          "API endpoint not found. Please: 1) Add get_inventory_hierarchy function to inventory.py, 2) Restart ERPNext server, 3) Reload this app.";
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
        "/api/method/printechs_utility.receivables.get_receivables_dashboard",
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
          "/api/method/printechs_utility.employee.get_complete_employees_data",
          params
        );
        const apiData = response.message || response;
        const parsed = EmployeesResponseSchema.parse(apiData);
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
      console.log("✅ Calling Approvals API...");

      // Use production server with user's authentication
      const baseUrl = useAuthStore.getState().serverConfig.serverUrl;
      const apiUrl = `${baseUrl}/api/method/printechs_utility.approvals.get_all_approvals`;

      try {
        console.log("🌐 Calling approvals API with production URL");

        // Use http.post for authenticated requests
        const payload = { ...params };
        if (!payload.territories) {
          const allowedTerritories =
            useAuthStore.getState().permissions.scope?.territories;
          if (
            Array.isArray(allowedTerritories) &&
            allowedTerritories.length > 0
          ) {
            payload.territories = allowedTerritories.join(",");
          }
        }

        // Enhanced logging for debugging missing invoices
        const permissions = useAuthStore.getState().permissions.scope;
        console.log("📤 Approvals API Request:", {
          apiUrl,
          payload,
          territories: payload.territories,
          permissions: permissions,
        });
        console.log("🔍 User Details for Debugging:", {
          user: useAuthStore.getState().user?.email,
          company: permissions?.company,
          territories: permissions?.territories,
          branch: permissions?.branch,
          territory: permissions?.territory,
        });

        const response = await http.post<any>(apiUrl, payload);

        // Handle nested message structure from production server
        console.log(
          "🔍 STEP 1 - Original response:",
          JSON.stringify(response, null, 2)
        );

        let apiData = response;

        // Check if response.data.message.message exists (double nesting)
        if (apiData?.message?.message) {
          console.log("🔧 Found double-nested message structure");
          apiData = apiData.message;
        }

        // Use message property if it exists, otherwise use data directly
        apiData = apiData?.message || apiData;

        console.log(
          "🔍 STEP 2 - After extraction apiData:",
          JSON.stringify(apiData, null, 2)
        );
        console.log("📊 Number of approvals:", apiData?.approvals?.length || 0);

        // Log each document type and check for specific invoice
        if (apiData?.approvals) {
          console.log("📑 Approvals array:", apiData.approvals);
          const types = apiData.approvals.reduce((acc: any, item: any) => {
            acc[item.doctype] = (acc[item.doctype] || 0) + 1;
            return acc;
          }, {});
          console.log("📑 Document types in response:", types);
          
          // Check for specific invoice number (e.g., SID25-000014)
          const specificInvoice = apiData.approvals.find(
            (item: any) => item.name === "SID25-000014" || item.id === "SID25-000014"
          );
          if (specificInvoice) {
            console.log("✅ Found SID25-000014:", JSON.stringify(specificInvoice, null, 2));
          } else {
            console.log("❌ SID25-000014 NOT found in approvals response");
            console.log("📋 All invoice names in response:", 
              apiData.approvals
                .filter((item: any) => item.doctype === "Sales Invoice")
                .map((item: any) => item.name || item.id)
            );
          }
        } else {
          console.log("❌ No approvals array found!");
        }

        // Log before validation
        console.log("🔍 STEP 3 - About to validate, apiData structure:", {
          hasApprovals: !!apiData?.approvals,
          approvalsLength: apiData?.approvals?.length,
          hasTotalPending: apiData?.total_pending !== undefined,
          hasTotalApproved: apiData?.total_approved !== undefined,
          hasTotalRejected: apiData?.total_rejected !== undefined,
        });

        // Try to parse the response, but log detailed error if validation fails
        let parsed;
        try {
          parsed = ApprovalsResponseSchema.parse(apiData);
          console.log("✅ Schema validation passed!");
          console.log("✅ Approved items:", parsed.approvals?.length || 0);
          console.log(
            "✅ Demo Approvals API loaded successfully with territory-filtered data"
          );
        } catch (validationError: any) {
          console.error("❌ Schema validation error!");
          console.error("❌ Error message:", validationError.message);
          console.error("❌ Error issues:", validationError.issues);
          console.error(
            "❌ Data that failed validation:",
            JSON.stringify(apiData, null, 2)
          );
          throw validationError;
        }

        console.log(
          "🔍 STEP 4 - Returning parsed data with",
          parsed?.approvals?.length || 0,
          "items"
        );
        console.log("📋 Final parsed data preview:", {
          approvalsCount: parsed?.approvals?.length || 0,
          firstItemDoctype: parsed?.approvals?.[0]?.doctype,
          firstItemName: parsed?.approvals?.[0]?.name,
        });
        return parsed;
      } catch (customError: any) {
        console.log("⚠️ Custom API failed:", customError);
        console.log("✅ Error details:", {
          message: customError?.message,
          status: customError?.response?.status,
          data: customError?.response?.data,
        });

        // Return mock data as fallback (filtered by territory)
        // Mock data shows documents from different territories
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
  async approveDocument(doctype: string, name: string, comment?: string) {
    try {
      console.log("✅ Approving document:", { doctype, name, comment });

      // Use production server with user's authentication
      const baseUrl = useAuthStore.getState().serverConfig.serverUrl;
      const approveUrl = `${baseUrl}/api/method/printechs_utility.approvals.approve_document`;

      try {
        const response = await http.post<any>(approveUrl, {
          doctype,
          name,
          comment,
        });

        console.log("✅ Document approved successfully");
        console.log("📄 Response:", response.message || response);
        return response.message || response;
      } catch (customError: any) {
        console.log("⚠️ Approve API failed:", customError);
        console.log("📄 Error Response Data:", customError?.response?.data);
        console.log("📄 Error Status:", customError?.response?.status);
        console.log("📄 Error Headers:", customError?.response?.headers);

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
              const lines = excStr.split("\n").filter(line => line.trim());
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

        console.log("📄 Final Error Message for User:", errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("❌ Approve Document Error:", error);
      throw error;
    }
  },

  /**
   * Reject a document
   * Returns: Success status
   */
  async rejectDocument(doctype: string, name: string, reason?: string) {
    try {
      console.log("❌ Rejecting document:", { doctype, name, reason });

      // Use production server with user's authentication
      const baseUrl = useAuthStore.getState().serverConfig.serverUrl;
      const rejectUrl = `${baseUrl}/api/method/printechs_utility.approvals.reject_document`;

      try {
        const response = await http.post<any>(rejectUrl, {
          doctype,
          name,
          reason,
        });

        console.log("✅ Document rejected successfully");
        console.log("📄 Response:", response.message || response);
        return response.message || response;
      } catch (customError: any) {
        console.log("⚠️ Reject API failed:", customError);
        console.log("📄 Error Response Data:", customError?.response?.data);
        console.log("📄 Error Status:", customError?.response?.status);
        console.log("📄 Error Headers:", customError?.response?.headers);

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

        console.log("📄 Final Error Message for User:", errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("❌ Reject Document Error:", error);
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

      // Direct call to the new backend endpoint
      console.log("🌐 Calling new get_employee_profile endpoint");
      const response = await http.get<any>(
        "/api/method/printechs_utility.employee.get_employee_profile",
        { email: currentUser.email }
      );
      const apiData = response.message || response;

      // Defensive: ensure the profile belongs to the current login
      const returnedEmail = (apiData?.user_profile?.company_email || "").trim().toLowerCase();
      const loginEmail = (currentUser.email || "").trim().toLowerCase();
      const belongsToLogin = !!loginEmail && (returnedEmail === loginEmail);

      // If mismatch, return minimal profile for the logged-in user (forces logo + username)
      const safeProfile = belongsToLogin
        ? apiData.user_profile
        : {
            image_url: "",
            employee_name: currentUser.full_name || currentUser.username || "User",
            company: currentUser.company || "",
            designation: currentUser.designation || "",
            branch: (currentUser as any).branch || "",
            territory: (currentUser as any).branch || "",
            cell_number: (currentUser as any).mobile_no || (currentUser as any).phone || "",
            company_email: currentUser.email || "",
            current_address: (currentUser as any).current_address || "",
            country: (currentUser as any).country || "",
          };

      // Build a compliant payload by adding qr_data (backend doesn't return it)
      const payload = {
        user_profile: safeProfile,
        qr_data: generateQRDataFromEmployee(safeProfile as any),
      };

      const parsed = UserProfileResponseSchema.parse(payload);
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
  async sendStatementByEmail(customer_name: string) {
    try {
      console.log(
        "📧 Sending Statement of Account via email for:",
        customer_name
      );

      // Use production server with user's authentication
      const baseUrl = useAuthStore.getState().serverConfig.serverUrl;

      const emailUrl = `${baseUrl}/api/method/printechs_utility.customer_notifications.send_statement_pdf`;

      try {
        const response = await http.post<any>(emailUrl, {
          customer_name,
        });

        console.log("✅ Statement sent successfully via email");
        console.log("📄 Response:", response.message || response);
        return response.message || response;
      } catch (customError: any) {
        console.log("⚠️ Send Email API failed:", customError);
        console.log("📄 Error Response Data:", customError?.response?.data);
        console.log("📄 Error Status:", customError?.response?.status);

        // Extract detailed error message from ERPNext response
        let errorMessage =
          "Failed to send statement via email. Please try again.";

        // ERPNext usually returns error in this format
        if (customError?.response?.data) {
          const errorData = customError.response.data;

          // Check for different error formats
          if (errorData.message) {
            // If message is an array, extract the actual error
            if (Array.isArray(errorData.message)) {
              const errorString = errorData.message[0] || "";
              // Extract user-friendly error message
              if (errorString.includes("Too many requests")) {
                errorMessage =
                  "Too many requests. Please wait an hour before requesting again.";
              } else if (errorString.includes("Failed to send statement")) {
                // Extract the actual error after "Failed to send statement:"
                const match = errorString.match(
                  /Failed to send statement: (.+)/
                );
                errorMessage = match
                  ? match[1]
                  : "Failed to send statement. Please try again.";
              } else {
                errorMessage =
                  "Failed to send statement via email. Please try again.";
              }
            } else if (typeof errorData.message === "string") {
              errorMessage = errorData.message;
            }
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

        console.log("📄 Final Error Message for User:", errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("❌ Send Email Error:", error);
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
      console.log("🔐 Calling Receivables Snapshot API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      console.log(
        "✅ Valid access token obtained for Receivables Snapshot API"
      );

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/printechs_utility.receivables.get_receivables_snapshot",
        params
      );

      const apiData = response.message || response;
      // Backward compatibility defaults for servers that don't return these fields yet
      const normalized = {
        overdueLt400: 0,
        oldBalance: 0,
        ...apiData,
      };
      const parsed = ReceivablesSnapshotResponseSchema.parse(normalized);
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
      console.log("🔐 Calling Receivables Performance API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      console.log(
        "✅ Valid access token obtained for Receivables Performance API"
      );

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/printechs_utility.receivables.get_receivables_performance",
        params
      );

      const apiData = response.message || response;
      const parsed = ReceivablesPerformanceResponseSchema.parse(apiData);
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
      console.log("🔐 Calling Receivables Trend API...");

      // Use configured server URL from user settings
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      // Ensure we have a valid access token before making the request
      const accessToken = await oauthApi.getValidToken();

      if (!accessToken) {
        throw new Error("No valid access token available");
      }

      console.log("✅ Valid access token obtained for Receivables Trend API");

      // Use GET with query params (no body) per server preference
      const response = await http.get<any>(
        "/api/method/printechs_utility.receivables.get_receivables_trends",
        params
      );

      const apiData = response.message || response;
      const parsed = ReceivablesTrendResponseSchema.parse(apiData);
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
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const response = await http.get<any>(
        "/api/method/printechs_utility.receivables.get_territory_receivables",
        params
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
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const response = await http.get<any>(
        "/api/method/printechs_utility.receivables.get_customer_statement",
        params
      );
      return response.message || response;
    } catch (error) {
      console.error("❌ Customer Statement API Error:", error);
      throw error;
    }
  },

  /**
   * Get list of all available catalogues
   */
  async getCataloguesList() {
    try {
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);
      const accessToken = await oauthApi.getValidToken();
      if (!accessToken) throw new Error("No valid access token available");

      const apiUrl = "/api/method/printechs_utility.catalogue.get_catalogues_list";
      console.log("🔍 Fetching catalogues list from:", serverUrl);
      console.log("🔍 API Endpoint:", apiUrl);
      console.log("🔍 Access Token:", accessToken ? "Present" : "Missing");
      
      const response = await http.get<any>(apiUrl);
      
      console.log("🔍 Raw catalogues API response TYPE:", typeof response);
      console.log("🔍 Raw catalogues API response:", JSON.stringify(response, null, 2));
      console.log("🔍 Response has 'message'?", !!response?.message);
      console.log("🔍 Response has 'catalogues'?", !!response?.catalogues);
      console.log("🔍 Response keys:", Object.keys(response || {}));
      
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
        "/api/method/printechs_utility.catalogue.get_catalogue_pages",
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
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;
      http.setBaseUrl(serverUrl);

      const payload = {
        expo_token: params.expoToken,
        platform: params.platform || "unknown",
        territory: params.territory,
        company: params.company,
      };

      await http.post(
        "/api/method/printechs_utility.api.store_push_token",
        payload
      );
      console.log("✅ Push token stored with backend");
    } catch (error) {
      console.error("❌ Store Push Token Error:", error);
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
