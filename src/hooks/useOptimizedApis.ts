import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  optimizedApis,
  type EmployeesData,
  type ApprovalsData,
  type UserProfileData,
  type ReceivablesSnapshotData,
  type ReceivablesPerformanceData,
  type ReceivablesTrendData,
} from "../api/optimized-apis";
import { shouldUseMockData } from "../api/mock";
import { fetchExecutiveDashboard } from "../api/executive";
import type { ExecutiveParams } from "../api/executive";
import type { ExecutiveDashboard } from "../api/executiveTypes";
import { useAuthStore } from "../store/auth";
import { getSalesTerritoriesParam } from "../api/accessScope";

// Re-export optimizedApis for direct use in components
export { optimizedApis };

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

// ========== DASHBOARD HOOKS ==========

/**
 * Phase 3A — Executive Dashboard 2.0 (single aggregated payload)
 */
export const useExecutiveDashboard = (
  params: ExecutiveParams = {},
  options?: { enabled?: boolean }
) => {
  const lastGoodRef = useRef<ExecutiveDashboard | null>(null);

  const query = useQuery({
    queryKey: ["executive-dashboard", params],
    queryFn: () => fetchExecutiveDashboard(params),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: (count, err: any) => {
      // Don't hammer BA on territory scope 403
      if (err?.status === 403 || err?.isBaScopeError) return false;
      return count < 1;
    },
    enabled: options?.enabled !== false,
    // Keep Sales KPIs on screen while period/territory refetch runs
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.data && !query.isError) {
      lastGoodRef.current = query.data;
    }
  }, [query.data, query.isError]);

  // After a failed territory switch, React Query drops data for that key —
  // fall back to the last successful executive payload so UI doesn't flip
  // to classic expandable cards.
  const data = query.data ?? lastGoodRef.current;
  const showingStaleOnError = Boolean(
    query.isError && !query.data && lastGoodRef.current
  );

  return {
    ...query,
    data,
    showingStaleOnError,
  };
};

/**
 * Single hook for Dashboard screen - gets all dashboard data in one API call
 */
export const useDashboardData = (
  params: {
    company?: string;
    from_date?: string;
    to_date?: string;
    territories?: string;
    territory?: string;
  } = {}
) => {
  const scope = useAuthStore((s) => s.permissions.scope);
  // Respect Allow View All Sales — do not pin Sales to a territory list
  const fromScope = getSalesTerritoriesParam(scope);
  const territoriesCsv =
    params.territories !== undefined ? params.territories : fromScope;
  const requestParams = {
    ...params,
    territories: territoriesCsv,
  };

  return useQuery({
    queryKey: ["dashboard-complete", requestParams],
    queryFn: async () => {
      return optimizedApis.getDashboardData(requestParams);
    },
    staleTime: 0, // No stale time - always fetch fresh data
    gcTime: 0, // No cache time - always fetch fresh data
    retry: 1,
  });
};

// Selector hooks for specific dashboard data
export const useDashboardKpis = (params = {}) => {
  const { data } = useDashboardData(params);
  return data?.kpis || [];
};

export const useDashboardCharts = (params = {}) => {
  const { data } = useDashboardData(params);
  return (
    data?.charts || {
      sales_daily: [],
      sales_by_territory: [],
      sales_by_division: [],
    }
  );
};

export const useDashboardUserProfile = (params = {}) => {
  const { data } = useDashboardData(params);
  return data?.user_profile;
};

// ========== EMPLOYEES HOOKS ==========

/**
 * Single hook for Employees screen - gets all employee data in one API call
 */
export const useEmployeesData = (
  params: {
    department?: string;
    designation?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) => {
  return useQuery({
    queryKey: ["employees-complete", params],
    queryFn: async () => {
      if (shouldUseMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 600));
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
      return optimizedApis.getEmployeesData(params);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  });
};

// Selector hooks for specific employee data
export const useEmployeesList = (params = {}) => {
  const query = useEmployeesData(params);
  const employees = query.data?.employees || [];
  return { ...query, data: employees };
};

export const useEmployeesFilters = (params = {}) => {
  const { data } = useEmployeesData(params);
  return {
    departments: data?.departments || [],
    designations: data?.designations || [],
    totalCount: data?.total_count || 0,
  };
};

// ========== APPROVALS HOOKS ==========

/**
 * Single hook for Approvals screen - gets all approval data in one API call
 */
export const useApprovalsData = (
  params: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
    territory?: string; // Add territory parameter
  } = {}
) => {
  // Approvals are scoped by approve_territories (e.g. Dammam only),
  // not the broader view_territories used for Sales analytics.
  const approveTerritories = useAuthStore(
    (s) => s.permissions.scope?.approve_territories
  );
  const approveBranch = useAuthStore((s) => s.permissions.scope?.branch);
  const approveCsv =
    approveTerritories && approveTerritories.length > 0
      ? approveTerritories.join(",")
      : approveBranch || params.territory || undefined;

  return useQuery({
    queryKey: ["approvals-complete", { ...params, territories: approveCsv }],
    queryFn: async () => {
      const requestParams = {
        ...params,
        territories: approveCsv,
        // Avoid sending a single profile territory that widens/narrows wrongly
        territory: undefined,
      };

      if (shouldUseMockData()) {
        // Reduced delay for faster loading - from 500ms to 100ms
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Mock approvals with territory = branch
        const mockApprovals = [
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
            territory: "Riyadh", // Territory = Branch
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
            territory: "Jeddah", // Territory = Branch
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
            territory: "Dammam", // Territory = Branch
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
            territory: "Riyadh", // Territory = Branch
            company: "Printechs",
            customer_outstanding: 0,
            customer_overdue: 0,
            outstanding_0_30: 0,
            outstanding_31_60: 0,
            outstanding_61_90: 0,
            outstanding_over_90: 0,
          },
        ];

        // Filter mock inbox by approve territories (comma CSV or single)
        const approveSet = new Set(
          (approveCsv || "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        const filteredApprovals = approveSet.size
          ? mockApprovals.filter((app) =>
              approveSet.has(String(app.territory || "").toLowerCase())
            )
          : mockApprovals;

        return {
          approvals: filteredApprovals,
          total_pending: filteredApprovals.length,
          total_approved: 0,
          total_rejected: 0,
          user_territory: approveCsv,
        } as ApprovalsData;
      }
      return optimizedApis.getApprovalsData(requestParams);
    },
    staleTime: 30 * 1000, // 30 seconds (approvals change frequently)
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    // Enable automatic refetch on window focus for live updates
    refetchOnWindowFocus: true,
    // Enable background refetch
    refetchOnMount: true,
  });
};

// Selector hooks for specific approval data
export const useApprovalsList = (params = {}) => {
  const { data, isLoading, error, refetch } = useApprovalsData(params);
  return {
    data: data?.approvals || [],
    isLoading,
    error,
    refetch,
  };
};

export const useApprovalsStats = (params = {}) => {
  const { data } = useApprovalsData(params);
  return {
    pending: data?.total_pending || 0,
    approved: data?.total_approved || 0,
    rejected: data?.total_rejected || 0,
  };
};

// ========== USER PROFILE HOOKS ==========

/**
 * Single hook for User Profile screen - gets all profile data in one API call
 */
export const useUserProfileData = () => {
  // Tie cache to the currently logged-in email so switching users invalidates profile
  const email = (() => {
    try {
      // subscribe to store so changes cause hook re-run
      const { useAuthStore } = require("../store/auth");
      return useAuthStore.getState().user?.email || "";
    } catch {
      return "";
    }
  })();

  return useQuery({
    queryKey: ["user-profile-complete", email],
    enabled: !!email,
    queryFn: async () => {
      if (shouldUseMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Get current user from auth store for mock data
        const { useAuthStore } = await import("../store/auth");
        const currentUser = useAuthStore.getState().user;

        return {
          user_profile: {
            image_url:
              currentUser?.user_image ||
              currentUser?.image ||
              currentUser?.photo_url ||
              "http://printechs.com/files/Sakeer.png",
            employee_name:
              currentUser?.full_name ||
              currentUser?.username ||
              "User",
            company: currentUser?.company || "",
            designation: currentUser?.designation || "",
            branch: currentUser?.branch || "",
            cell_number: currentUser?.mobile_no || currentUser?.phone || "",
            company_email: currentUser?.email || "",
            current_address:
              currentUser?.location || currentUser?.current_address || "",
            country: currentUser?.country || "",
          },
          qr_data: currentUser
            ? generateQRData(currentUser)
            : "BEGIN:VCARD\nVERSION:3.0\nFN:User\nORG:\nTITLE:\nTEL:\nEMAIL:\nADR:;\nEND:VCARD",
        } as UserProfileData;
      }
      return optimizedApis.getUserProfileData();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (profile data changes less frequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
};

// Selector hooks for specific profile data
export const useUserProfile = () => {
  const { data, isLoading, error } = useUserProfileData();
  return {
    data: data?.user_profile,
    isLoading,
    error,
  };
};

export const useProfileQRData = () => {
  const { data, isLoading, error } = useUserProfileData();
  return {
    data: data?.qr_data || "",
    isLoading,
    error,
  };
};

// ========== RECEIVABLES HOOKS ==========

/**
 * Hook for Receivables Snapshot data
 * Returns: Total unpaid, total overdue, overdue breakdown, DSO, and collection metrics
 */
export const useReceivablesSnapshot = () => {
  return useQuery({
    queryKey: ["receivables-snapshot"],
    queryFn: async () => {
      // Always use real API data - no mock data
      return optimizedApis.getReceivablesSnapshot();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (receivables change frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

// ========== INVENTORY HOOKS ==========

export const useInventorySnapshot = (params?: {
  company?: string;
  warehouse?: string;
  low_stock_threshold?: number;
}) => {
  return useQuery({
    queryKey: ["inventory-snapshot", params],
    queryFn: async () => optimizedApis.getInventorySnapshot(params || {}),
    staleTime: Infinity, // Never consider data stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
    retry: 1,
    refetchOnMount: false, // Don't auto-refetch on mount - only when user clicks refresh
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
  });
};

export const useInventoryPerformance = (params?: {
  company?: string;
  warehouse?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["inventory-performance", params],
    queryFn: async () => optimizedApis.getInventoryPerformance(params || {}),
    staleTime: Infinity, // Never consider data stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
    retry: 1,
    refetchOnMount: false, // Don't auto-refetch on mount - only when user clicks refresh
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
  });
};

export const useInventoryTrends = (params?: {
  company?: string;
  warehouse?: string;
  months?: number;
}) => {
  return useQuery({
    queryKey: ["inventory-trends", params],
    queryFn: async () => optimizedApis.getInventoryTrends(params || {}),
    staleTime: Infinity, // Never consider data stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
    retry: 1,
    refetchOnMount: false, // Don't auto-refetch on mount - only when user clicks refresh
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
  });
};

export const useInventoryRisk = (params?: {
  company?: string;
  warehouse?: string;
}) => {
  return useQuery({
    queryKey: ["inventory-risk", params],
    queryFn: async () => optimizedApis.getInventoryRisk(params || {}),
    staleTime: Infinity, // Never consider data stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
    retry: 1,
    refetchOnMount: false, // Don't auto-refetch on mount - only when user clicks refresh
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
  });
};

export type InventoryHierarchyLevel =
  | "territory"
  | "warehouse"
  | "category"
  | "item_group"
  | "brand"
  | "item";

export const useInventoryHierarchy = (
  params: {
    company?: string;
    warehouse?: string;
    level: InventoryHierarchyLevel;
    territory?: string;
    territories?: string;
    category?: string;
    item_group?: string;
    brand?: string;
    item_code?: string;
    limit?: number;
  },
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["inventory-hierarchy", params],
    queryFn: async () => optimizedApis.getInventoryHierarchy(params),
    staleTime: Infinity, // Never consider data stale - always use cache first
    gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
    retry: 1,
    refetchOnMount: false, // Don't auto-refetch on mount - only when user clicks refresh
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
    enabled: options?.enabled !== false, // Default to true if not specified
  });
};

/**
 * Hook for Receivables Performance data
 * Returns: Top overdue customers, invoices, aging breakdown, and collection efficiency
 */
export const useReceivablesPerformance = () => {
  return useQuery({
    queryKey: ["receivables-performance"],
    queryFn: async () => {
      // Always use real API data - no mock data
      return optimizedApis.getReceivablesPerformance();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (receivables change frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

/**
 * Hook for Receivables Trend data
 * Returns: AR trends, territory breakdown, overdue trends, and sales vs collection
 */
export const useReceivablesTrend = () => {
  return useQuery({
    queryKey: ["receivables-trend"],
    queryFn: async () => {
      // Always use real API data - no mock data
      return optimizedApis.getReceivablesTrend();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (receivables change frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
