import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { storage } from "./storage";
import { oauthApi } from "./oauth";
import { isMissingBaMethodError } from "./baErrors";
import {
  isNetworkOrTlsError,
  normalizeServerUrl,
  resolveServerBaseUrl,
} from "./serverUrl";
import { logger } from "../utils/logger";

export class HttpClient {
  private client: AxiosInstance;
  private onUnauthorized?: () => void;

  constructor(baseURL: string) {
    // Allow empty baseURL - it will be set later from serverConfig
    if (baseURL && typeof baseURL !== "string") {
      logger.error("❌ Invalid baseURL provided to HttpClient:", baseURL);
      throw new Error("Invalid baseURL provided to HttpClient");
    }

    const normalized = resolveServerBaseUrl(baseURL);
    this.client = axios.create({
      baseURL: normalized,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Expect: "", // Disable Expect: 100-continue to prevent 417 errors
      },
      // Add CORS configuration
      withCredentials: false,
      maxRedirects: 5,
    });

    this.setupInterceptors();
  }

  setBaseUrl(baseURL: string) {
    if (baseURL && typeof baseURL !== "string") {
      logger.error("❌ Invalid baseURL provided to setBaseUrl:", baseURL);
      return;
    }
    // Allow empty baseURL - it means no server configured yet
    if (!baseURL) {
      logger.info(
        "⚠️ Empty baseURL provided to setBaseUrl - no server configured"
      );
      this.client.defaults.baseURL = "";
      return;
    }
    const normalized = normalizeServerUrl(baseURL);
    if (normalized.remapped) {
      logger.warn("⚠️ Server URL remapped:", normalized.note);
    }
    this.client.defaults.baseURL = normalized.url;
    logger.info(
      "✅ HTTP Client baseURL updated to:",
      this.client.defaults.baseURL
    );
  }

  getBaseUrl(): string {
    return this.client.defaults.baseURL || "";
  }

  /** Prefer live axios baseURL; if empty, heal from auth store. */
  private syncBaseUrlFromStore() {
    if (this.client.defaults.baseURL) {
      // Heal stored apex / alias hosts even when baseURL is already set
      const healed = resolveServerBaseUrl(this.client.defaults.baseURL);
      if (healed && healed !== this.client.defaults.baseURL) {
        this.client.defaults.baseURL = healed;
      }
      return;
    }
    try {
      // Lazy import avoids circular init with auth store
      const { useAuthStore } = require("../store/auth") as typeof import("../store/auth");
      const stored = useAuthStore.getState().serverConfig?.serverUrl;
      if (stored) this.setBaseUrl(stored);
    } catch {
      /* store may not be ready yet */
    }
  }

  /** Join base + path without doubling when `url` is already absolute. */
  private resolveFullUrl(url?: string, base?: string): string {
    const u = url || "";
    if (/^https?:\/\//i.test(u)) return u;
    const b = (base || this.client.defaults.baseURL || "").replace(/\/$/, "");
    if (!b) return u;
    if (!u) return b;
    return `${b}${u.startsWith("/") ? u : `/${u}`}`;
  }

  private isSilentRequest(config?: AxiosRequestConfig): boolean {
    return Boolean(
      (config as { silentError?: boolean } | undefined)?.silentError
    );
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Validate config
          if (!config || !config.url) {
            logger.error("❌ Invalid request config:", config);
            throw new Error("Invalid request configuration");
          }

          this.syncBaseUrlFromStore();
          if (!config.baseURL && this.client.defaults.baseURL) {
            config.baseURL = this.client.defaults.baseURL;
          }

          // Absolute URLs must not keep a baseURL — some clients concatenate
          // and produce https://hosthttps://host/api/...
          if (/^https?:\/\//i.test(config.url)) {
            try {
              const parsed = new URL(config.url);
              const healedBase = resolveServerBaseUrl(
                `${parsed.protocol}//${parsed.host}`
              );
              if (healedBase && healedBase !== `${parsed.protocol}//${parsed.host}`) {
                config.url = `${healedBase}${parsed.pathname}${parsed.search}`;
              }
            } catch {
              /* keep as-is */
            }
            config.baseURL = undefined;
          }

          const absoluteUrl = this.resolveFullUrl(
            config.url,
            config.baseURL || this.client.defaults.baseURL
          );
          if (
            config.url.startsWith("/api/") &&
            !(config.baseURL || this.client.defaults.baseURL)
          ) {
            logger.error(
              "❌ No server URL configured — cannot call",
              config.url
            );
            return Promise.reject(
              new Error(
                "No server URL configured. Open Settings → Configure Server and save https://printechs.com"
              )
            );
          }

          const urlPath = config.url || "";
          const isOAuthOrPublic =
            urlPath.includes("frappe.integrations.oauth2") ||
            urlPath.includes("erp_analysis.auth_otp") ||
            urlPath.includes("erp_analysis.config.get_client_id");

          // Protect Frappe method + resource APIs (Bearer). Only strip auth for OAuth/public.
          const isProtectedEndpoint =
            !isOAuthOrPublic &&
            (urlPath.includes("/api/method/") ||
              urlPath.includes("/api/resource/"));

          if (isProtectedEndpoint) {
            const accessToken = await oauthApi.getValidToken();
            if (accessToken) {
              config.headers = config.headers || {};
              config.headers.Authorization = `Bearer ${accessToken}`;
            } else {
              logger.debug(
                "No access token for protected endpoint",
                urlPath
              );
            }
          } else if (isOAuthOrPublic) {
            // For OAuth / public config endpoints, ensure no auth header
            if (config.headers) {
              delete config.headers.Authorization;
              delete config.headers.authorization;
            }
            logger.info("🌐 Making unauthenticated request for OAuth/public endpoint");
          } else {
            const accessToken = await oauthApi.getValidToken();
            if (accessToken) {
              config.headers = config.headers || {};
              config.headers.Authorization = `Bearer ${accessToken}`;
            }
          }

          // Explicitly remove Expect header to prevent 417 errors
          if (config.headers) {
            if (config.headers.Expect) {
              delete config.headers.Expect;
            }
            if (config.headers.expect) {
              delete config.headers.expect;
            }
          }

          logger.info(
            `🚀 HTTP Request: ${config.method?.toUpperCase()} ${absoluteUrl}`
          );
          return config;
        } catch (error) {
          logger.error("❌ Request interceptor error:", error);
          return Promise.reject(error);
        }
      },
      (error) => {
        logger.error("❌ Request interceptor setup error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => {
        logger.info(
          `✅ HTTP Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error: AxiosError) => {
        const url = error.config?.url || "";
        const status = error.response?.status;
        const silent = this.isSilentRequest(error.config);

        // Silently handle expected 403 errors on non-whitelisted ERPNext methods
        const responseData = error.response?.data as any;
        const serverMessage: string | undefined =
          typeof responseData?.message === "string"
            ? responseData.message
            : undefined;
        const serverMessagesStr: string | undefined =
          typeof responseData?._server_messages === "string"
            ? responseData._server_messages
            : undefined;
        const exceptionStr: string | undefined =
          typeof responseData?.exception === "string"
            ? responseData.exception
            : undefined;

        const permissionErrorDetected =
          status === 403 &&
          (responseData?.exc_type === "PermissionError" ||
            (serverMessage &&
              serverMessage.toLowerCase().includes("access denied")) ||
            (serverMessagesStr &&
              serverMessagesStr.toLowerCase().includes("access denied")) ||
            (exceptionStr &&
              exceptionStr.toLowerCase().includes("permissionerror")));

        // BA often returns 403 for Access Profile / module scope (not a bad token)
        const isBaScope403 =
          status === 403 &&
          (url.includes("get_executive_dashboard") ||
            url.includes("erp_analysis.executive") ||
            url.includes("erp_analysis.sales_kpis") ||
            url.includes("erp_analysis.profitability") ||
            url.includes("get_profitability_dashboard") ||
            url.includes("erp_analysis.customer") ||
            url.includes("search_customers") ||
            url.includes("get_customer_360") ||
            url.includes("get_product_performance") ||
            url.includes("get_salesperson_performance"));

        const isExpected403 =
          status === 403 &&
          (url.includes("frappe.auth.get_logged_user") ||
            url.includes("get_logged_user") ||
            permissionErrorDetected ||
            isBaScope403);

        const missingMethodBlob = JSON.stringify(
          responseData || serverMessage || exceptionStr || ""
        ).toLowerCase();
        const isMissingMethod417 =
          status === 417 &&
          (missingMethodBlob.includes("failed to get method") ||
            missingMethodBlob.includes("has no attribute") ||
            missingMethodBlob.includes("no module named") ||
            missingMethodBlob.includes("does not exist") ||
            url.includes("erp_analysis."));

        const isSoft417 =
          (status === 417 && url.includes("store_push_token")) ||
          isMissingMethod417;

        const isTimeoutError =
          error.code === "ECONNABORTED" ||
          error.code === "ETIMEDOUT" ||
          error.message?.toLowerCase().includes("timeout");

        if (!isExpected403 && !isSoft417 && !silent && !isTimeoutError) {
          const fullUrl = this.resolveFullUrl(
            url,
            error.config?.baseURL || this.client.defaults.baseURL
          );
          logger.error("❌ HTTP Error:", {
            message: error.message,
            status: status,
            url: fullUrl || url,
            code: error.code,
            data: error.response?.data,
          });
        }

        // Missing BA methods (417) are expected on sites that have not shipped Phase 3 yet
        if (isMissingMethod417) {
          // Quiet — callers use withBaDemoFallback / live Frappe fallbacks
        } else if (status === 417 && !isSoft417) {
          logger.info("⚠️ 417 error - API endpoint not found (not an auth issue)");
          // Don't try to refresh or logout - just pass the error through
        } else if (
          status === 401 ||
          (status === 403 && !isExpected403)
        ) {
          // Try to refresh token for protected endpoints
          const isProtectedEndpoint =
            (url.includes("/api/method/") || url.includes("/api/resource/")) &&
            !url.includes("erp_analysis.auth_otp") &&
            !url.includes("frappe.integrations.oauth2");

          if (isProtectedEndpoint) {
            logger.info(
              "🔄 Token expired, invalid, or missing (401/403) - attempting refresh..."
            );

            try {
              const refreshResult = await oauthApi.refreshToken();

              if (refreshResult.success && refreshResult.data) {
                logger.info(
                  "✅ Token refreshed successfully - retrying request"
                );

                // Retry the original request with new token
                const newToken = refreshResult.data.access_token;
                if (error.config) {
                  error.config.headers = error.config.headers || {};
                  error.config.headers.Authorization = `Bearer ${newToken}`;

                  // Retry the request
                  return this.client.request(error.config);
                }
              } else {
                // Check if error is recoverable (temporary network/server issue).
                // Do NOT match the substring "server" inside "No server URL configured".
                const errLower = (refreshResult.error || "").toLowerCase();
                const isMissingServerUrl =
                  errLower.includes("no server url") ||
                  errLower.includes("server url configured");
                const isRecoverable =
                  !isMissingServerUrl &&
                  (refreshResult.isRecoverable === true ||
                    errLower.includes("network") ||
                    errLower.includes("timeout") ||
                    errLower.includes("connection") ||
                    errLower.includes("econn") ||
                    /\b5\d\d\b/.test(errLower) ||
                    errLower.includes("server error") ||
                    errLower.includes("service unavailable"));

                if (isRecoverable) {
                  // Temporary error - don't logout, just fail the request
                  // User stays logged in, will retry on next API call
                  logger.info("⚠️ Temporary refresh failure (recoverable) - request will fail but user stays logged in");
                  logger.info("⚠️ Error:", refreshResult.error);
                  // Reject the error so the caller can handle it
                  return Promise.reject(error);
                } else {
                  // Refresh token is invalid/expired - logout user
                  logger.info("❌ Refresh token invalid (non-recoverable) - logging out");
                  logger.info("❌ Error:", refreshResult.error);
                  this.onUnauthorized?.();
                }
              }
            } catch (refreshError: any) {
              // Exception during refresh - check if it's a network error
              const isNetworkError = 
                !refreshError.response ||
                refreshError.code === "ECONNABORTED" ||
                refreshError.code === "ETIMEDOUT" ||
                refreshError.code === "ENOTFOUND" ||
                refreshError.code === "ECONNREFUSED" ||
                refreshError.message?.toLowerCase().includes("network") ||
                refreshError.message?.toLowerCase().includes("timeout");

              if (isNetworkError) {
                // Network error - don't logout, just fail the request
                logger.error("⚠️ Network error during token refresh - request will fail but user stays logged in");
                return Promise.reject(error);
              } else {
                // Other error - logout
                logger.error("❌ Token refresh error:", refreshError);
                this.onUnauthorized?.();
              }
            }
          } else {
            logger.info("🔒 Unauthorized access - triggering logout");
            this.onUnauthorized?.();
          }
        }

        // Handle network errors (no HTTP response body) — SSL failures look like this too
        if (!error.response) {
          const base =
            error.config?.baseURL || this.client.defaults.baseURL || "";
          const fullUrl = this.resolveFullUrl(url, base);
          const isTimeout =
            error.code === "ECONNABORTED" ||
            error.message?.toLowerCase().includes("timeout");
          if (isTimeout) {
            if (!silent) {
              logger.warn("⏱ Request timed out:", fullUrl);
            }
            return Promise.reject(
              new Error(
                "Request timed out. The server took too long to respond."
              )
            );
          }
          if (isNetworkOrTlsError(error)) {
            if (!silent) {
              logger.warn("🌐 Network/TLS error — no response:", fullUrl);
            }
            const hostHint =
              resolveServerBaseUrl(base) ||
              (/^https?:\/\//i.test(url) ? url : base);
            return Promise.reject(
              new Error(
                hostHint
                  ? `Unable to connect to ${hostHint}. Check the server URL (use https://printechs.com for live) and your network.`
                  : "Network error: Unable to connect to server. Configure a server URL in Settings."
              )
            );
          }
          if (!silent) {
            logger.warn("🌐 Network error - no response received:", fullUrl);
          }
          return Promise.reject(
            new Error("Network error: Unable to connect to server")
          );
        }

        return Promise.reject(error);
      }
    );
  }

  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  async get<T>(
    url: string,
    params?: any,
    requestConfig?: AxiosRequestConfig & { silentError?: boolean }
  ): Promise<T> {
    try {
      if (!url || typeof url !== "string") {
        throw new Error("Invalid URL provided to GET request");
      }
      const { silentError, ...axiosConfig } = requestConfig || {};
      const response = await this.client.get(url, {
        ...axiosConfig,
        silentError,
        ...(params !== undefined ? { params } : {}),
      } as AxiosRequestConfig & { silentError?: boolean });
      return response.data;
    } catch (error) {
      try {
        const softMissing =
          typeof url === "string" &&
          (url.includes("clear_my_access_cache") ||
            isMissingBaMethodError(error));
        const silent = Boolean(
          (requestConfig as { silentError?: boolean } | undefined)?.silentError
        );
        const ax = error as AxiosError;
        const networkNoResponse = !ax.response && isNetworkOrTlsError(error);
        const isTimeout =
          ax.code === "ECONNABORTED" ||
          String(ax.message || "")
            .toLowerCase()
            .includes("timeout");
        if (!softMissing && !silent && !networkNoResponse && !isTimeout) {
          logger.error("❌ GET request failed:", url, error);
        } else if (isTimeout && !silent) {
          logger.warn("⏱ GET timed out:", url);
        }
      } catch {}
      throw error;
    }
  }

  async post<T>(
    url: string,
    data?: any,
    requestConfig?: AxiosRequestConfig & { silentError?: boolean }
  ): Promise<T> {
    const silentError = Boolean(requestConfig?.silentError);
    const { silentError: _silent, ...axiosConfig } = requestConfig || {};
    try {
      if (!url || typeof url !== "string") {
        throw new Error("Invalid URL provided to POST request");
      }
      const response = await this.client.post(url, data, {
        ...axiosConfig,
        silentError,
      } as AxiosRequestConfig & { silentError?: boolean });
      return response.data;
    } catch (error) {
      try {
        // Silence noise for known benign routes (e.g., logout-time cache clear)
        if (typeof url === "string" && url.includes("clear_my_access_cache")) {
          // Do not log
        } else {
          const ax = error as AxiosError;
          const quiet417Push =
            typeof url === "string" &&
            url.includes("store_push_token") &&
            ax.response?.status === 417;
          const softMissing = isMissingBaMethodError(error);
          const permDenied = ax.response?.status === 403;
          const networkNoResponse = !ax.response && isNetworkOrTlsError(error);
          if (permDenied) {
            logger.warn(
              "⚠️ POST 403 (Access Profile):",
              url,
              (ax.response?.data as any)?.exception || ax.message
            );
          } else if (
            !quiet417Push &&
            !softMissing &&
            !networkNoResponse &&
            !silentError
          ) {
            logger.error("❌ POST request failed:", url, error);
          }
        }
      } catch {}
      throw error;
    }
  }

  async put<T>(url: string, data?: any): Promise<T> {
    try {
      if (!url || typeof url !== "string") {
        throw new Error("Invalid URL provided to PUT request");
      }
      const response = await this.client.put(url, data);
      return response.data;
    } catch (error) {
      logger.error("❌ PUT request failed:", url, error);
      throw error;
    }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      if (!url || typeof url !== "string") {
        throw new Error("Invalid URL provided to DELETE request");
      }
      const response = await this.client.delete(url);
      return response.data;
    } catch (error) {
      logger.error("❌ DELETE request failed:", url, error);
      throw error;
    }
  }
}

// Create singleton instance with empty base URL
// Base URL will be set dynamically from serverConfig in auth store
export const http = new HttpClient("");

// Helper to encode ERPNext filters
export const encodeFilters = (filters: any[]): string => {
  return JSON.stringify(filters);
};

// Helper to encode fields
export const encodeFields = (fields: string[]): string => {
  return JSON.stringify(fields);
};
