/**
 * erp_analysis API method paths (Frappe whitelisted methods).
 * Auth OTP remains local/demo-only; real servers use password OAuth grant.
 */
export const ERP_ANALYSIS = {
  config: {
    getClientId: "/api/method/erp_analysis.config.get_client_id",
    getMobileConfig: "/api/method/erp_analysis.api.get_mobile_config",
    getMobileBootstrap: "/api/method/erp_analysis.api.get_mobile_bootstrap",
    getDimensionValues: "/api/method/erp_analysis.api.get_dimension_values",
    getDashboardWidgetData:
      "/api/method/erp_analysis.api.get_dashboard_widget_data",
    /** Batch: all widgets for one dashboard board in one call */
    getDashboardBoardData:
      "/api/method/erp_analysis.api.get_dashboard_board_data",
    health: "/api/method/erp_analysis.api.health",
  },
  api: {
    getMyAccess: "/api/method/erp_analysis.api.get_my_access",
    clearMyAccessCache: "/api/method/erp_analysis.api.clear_my_access_cache",
    storePushToken: "/api/method/erp_analysis.api.store_push_token",
  },
  dashboard: {
    getCompleteDashboardData:
      "/api/method/erp_analysis.dashboard.get_complete_dashboard_data",
    getExecutiveDashboard:
      "/api/method/erp_analysis.dashboard.get_executive_dashboard",
  },
  /** Phase 3 BA modules (in scope — targets/cash deferred) */
  executive: {
    getDashboard:
      "/api/method/erp_analysis.executive.get_executive_dashboard",
  },
  collection: {
    getDashboard:
      "/api/method/erp_analysis.collection.get_collection_dashboard",
    getAttention:
      "/api/method/erp_analysis.collection.get_collection_attention",
  },
  customer360: {
    get: "/api/method/erp_analysis.customer.get_customer_360",
    search: "/api/method/erp_analysis.customer.search_customers",
  },
  salesOrders: {
    getDashboard:
      "/api/method/erp_analysis.sales_orders.get_sales_order_dashboard",
  },
  payables: {
    getDashboard:
      "/api/method/erp_analysis.payables.get_payables_dashboard",
    getPaymentPlanning:
      "/api/method/erp_analysis.payables.get_payment_planning",
  },
  purchase: {
    getDashboard:
      "/api/method/erp_analysis.purchase.get_purchase_dashboard",
  },
  inventoryHealth: {
    getHealth:
      "/api/method/erp_analysis.inventory.get_inventory_health",
    getStockCover:
      "/api/method/erp_analysis.inventory.get_stock_cover",
    getDeadStock:
      "/api/method/erp_analysis.inventory.get_dead_stock",
  },
  profitability: {
    getDashboard:
      "/api/method/erp_analysis.profitability.get_profitability_dashboard",
  },
  exceptions: {
    getManagementExceptions:
      "/api/method/erp_analysis.exceptions.get_management_exceptions",
  },
  approvalAnalytics: {
    get:
      "/api/method/erp_analysis.approvals.get_approval_analytics",
  },
  analytics: {
    getGenericAnalysis:
      "/api/method/erp_analysis.analytics.get_generic_analysis",
  },
  salesperson: {
    getPerformance:
      "/api/method/erp_analysis.sales.get_salesperson_performance",
  },
  product: {
    getPerformance:
      "/api/method/erp_analysis.sales.get_product_performance",
  },
  inventory: {
    getSnapshot: "/api/method/erp_analysis.inventory.get_inventory_snapshot",
    getPerformance:
      "/api/method/erp_analysis.inventory.get_inventory_performance",
    getTrends: "/api/method/erp_analysis.inventory.get_inventory_trends",
    getRisk: "/api/method/erp_analysis.inventory.get_inventory_risk",
    getHierarchy: "/api/method/erp_analysis.inventory.get_inventory_hierarchy",
  },
  receivables: {
    getDashboard:
      "/api/method/erp_analysis.receivables.get_receivables_dashboard",
    getSnapshot: "/api/method/erp_analysis.receivables.get_receivables_snapshot",
    getPerformance:
      "/api/method/erp_analysis.receivables.get_receivables_performance",
    getTrends: "/api/method/erp_analysis.receivables.get_receivables_trends",
    getTerritoryReceivables:
      "/api/method/erp_analysis.receivables.get_territory_receivables",
    getCustomerStatement:
      "/api/method/erp_analysis.receivables.get_customer_statement",
  },
  employee: {
    getCompleteEmployeesData:
      "/api/method/erp_analysis.employee.get_complete_employees_data",
    getEmployeeProfile: "/api/method/erp_analysis.employee.get_employee_profile",
    getEmployees: "/api/method/erp_analysis.employee.get_employees",
  },
  approvals: {
    getAllApprovals: "/api/method/erp_analysis.approvals.get_all_approvals",
    approveDocument: "/api/method/erp_analysis.approvals.approve_document",
    rejectDocument: "/api/method/erp_analysis.approvals.reject_document",
    inbox: "/api/method/erp_analysis.approvals.inbox",
    apply: "/api/method/erp_analysis.approvals.apply",
  },
  salesKpis: {
    getDashboardKpis: "/api/method/erp_analysis.sales_kpis.get_dashboard_kpis",
    getSalesDashboard: "/api/method/erp_analysis.sales_kpis.get_sales_dashboard",
  },
  catalogue: {
    getCataloguesList: "/api/method/erp_analysis.catalogue.get_catalogues_list",
    getCataloguePages: "/api/method/erp_analysis.catalogue.get_catalogue_pages",
    getCatalogueFlipUrl:
      "/api/method/erp_analysis.catalogue.get_catalogue_flip_url",
  },
  customerNotifications: {
    sendStatementPdf:
      "/api/method/erp_analysis.customer_notifications.send_statement_pdf",
  },
} as const;

/** Phase-2 modules — hidden until enabled here AND by server config */
export const PHASE2_FEATURES = {
  catalogue: false,
  push: false,
} as const;
