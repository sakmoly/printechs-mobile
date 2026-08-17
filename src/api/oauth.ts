import { http } from "./http";
import { storage } from "./storage";
import { useAuthStore } from "../store/auth";
import { isDemoMode } from "./demoMode";
import { ERP_ANALYSIS } from "./endpoints";
import { logger } from "../utils/logger";

const DEMO_ACCESS = "printechs_demo_access_token";
const DEMO_REFRESH = "printechs_demo_refresh_token";

export interface OTPRequest {
  identifier: string;
  client_id: string;
  channel: "email" | "sms";
}

export interface OTPResponse {
  message: {
    token_type: "Bearer";
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    user: string;
  };
}

export interface OTPExchangeRequest {
  identifier: string;
  otp: string;
  client_id: string;
}

export interface TokenData {
  token_type: "Bearer";
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  user: string;
  expires_at: number; // Timestamp when token expires
}

/**
 * Helper function to get client_id from configuration
 * Falls back to default if not set
 */
const getClientId = (): string => {
  const serverConfig = useAuthStore.getState().serverConfig;
  // Use configured client_id if available, otherwise fall back to default
  return serverConfig.clientId || "55d4241f3a";
};

export const oauthApi = {
  /**
   * Login with username/password via Frappe OAuth2 password grant.
   * Requires an OAuth Client on the ERP site with Password grant enabled.
   */
  async loginWithPassword(
    username: string,
    password: string
  ): Promise<{ success: boolean; data?: TokenData; error?: string }> {
    try {
      const serverConfig = useAuthStore.getState().serverConfig;
      const baseUrl = (serverConfig.serverUrl || "").replace(/\/$/, "");
      if (!baseUrl) {
        return {
          success: false,
          error: "No server URL configured. Enter your ERPNext URL first.",
        };
      }

      const clientId = getClientId();
      logger.info("🔐 Password login via OAuth grant, client_id:", clientId);

      const axios = (await import("axios")).default;
      const formData = new URLSearchParams();
      formData.append("grant_type", "password");
      formData.append("username", username.trim());
      formData.append("password", password);
      formData.append("client_id", clientId);

      const response = await axios.post(
        `${baseUrl}/api/method/frappe.integrations.oauth2.get_token`,
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          timeout: 20000,
        }
      );

      const payload = response.data?.message ?? response.data;
      if (!payload?.access_token) {
        return {
          success: false,
          error: "Invalid login response from server",
        };
      }

      const tokenData: TokenData = {
        token_type: payload.token_type || "Bearer",
        access_token: payload.access_token,
        expires_in: payload.expires_in || 3600,
        refresh_token: payload.refresh_token || "",
        scope: payload.scope || "all",
        user: payload.user || username.trim(),
        expires_at: Date.now() + (payload.expires_in || 3600) * 1000,
      };

      await storage.setToken(tokenData.access_token);
      if (tokenData.refresh_token) {
        await storage.setItem("refresh_token", tokenData.refresh_token);
      }
      await storage.setItem("token_data", JSON.stringify(tokenData));
      await storage.setItem("user_identifier", username.trim());

      logger.info("✅ Password login successful");
      return { success: true, data: tokenData };
    } catch (error: any) {
      logger.error("❌ Password login failed:", error);
      const status = error?.response?.status;
      const desc =
        error?.response?.data?.error_description ||
        error?.response?.data?.message ||
        error?.message;

      let errorMessage = "Login failed";
      if (status === 401 || status === 403) {
        errorMessage = "Invalid username or password";
      } else if (status === 400) {
        errorMessage =
          typeof desc === "string"
            ? desc
            : "Login rejected. Ensure OAuth Client allows Password grant and client ID is correct.";
      } else if (typeof desc === "string") {
        errorMessage = desc;
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Request OTP for authentication
   */
  async requestOTP(
    identifier: string,
    channel: "email" | "sms" = "email"
  ): Promise<{ success: boolean; error?: string }> {
    let config: any = null;
    let baseUrl = "";

    try {
      if (isDemoMode()) {
        logger.info("📧 Demo mode: skipping OTP request to server");
        return { success: true };
      }

      logger.info("📧 Requesting OTP for:", identifier);

      const clientId = getClientId();
      logger.info("🔑 Using client_id:", clientId);

      const requestData: OTPRequest = {
        identifier,
        client_id: clientId,
        channel,
      };

      logger.info("📤 Request Data:", JSON.stringify(requestData, null, 2));

      // Create a simple unauthenticated HTTP client for OTP request
      const serverConfig = await storage.getItem("serverConfig");
      config = serverConfig ? JSON.parse(serverConfig) : null;
      baseUrl = config?.serverUrl || "";

      // If no base URL, check the auth store as fallback
      if (!baseUrl) {
        const authStoreConfig = useAuthStore.getState().serverConfig;
        baseUrl = authStoreConfig.serverUrl || "";
        logger.info(
          "⚠️ No server config in storage, using auth store:",
          baseUrl
        );
      }

      if (!baseUrl) {
        throw new Error(
          "No server URL configured. Please configure the server URL in Settings."
        );
      }

      logger.info("🌐 Using base URL:", baseUrl);
      logger.info(
        "📡 Full URL:",
        `${baseUrl}/api/method/erp_analysis.auth_otp.request_otp`
      );

      // Use axios directly without authentication
      const axios = (await import("axios")).default;
      const response = await axios.post(
        `${baseUrl}/api/method/erp_analysis.auth_otp.request_otp`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      logger.info("✅ OTP request successful");
      logger.info("📥 Response:", response.data);
      return { success: true };
    } catch (error: any) {
      logger.error("❌ OTP request failed:", error);
      logger.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        baseUrl: config?.serverUrl,
        clientId: getClientId(),
      });

      let errorMessage = "Failed to send OTP";

      if (
        error.code === "NETWORK_ERROR" ||
        error.message?.includes("Network Error")
      ) {
        errorMessage =
          "Network error. Please check your internet connection and server URL.";
      } else if (error.response?.status === 401) {
        errorMessage =
          "Authentication failed. Please check your server configuration and client ID.";
      } else if (error.response?.status === 404) {
        errorMessage =
          "OTP API not found. Please ensure the backend API is deployed.";
      } else if (error.response?.status === 417) {
        errorMessage =
          error.response?.data?.message ||
          "OTP validation failed. Please check your email and try again.";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid email address or request format.";
      } else if (error.response?.status === 500) {
        errorMessage =
          "Server error. Please try again later or contact support.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      logger.error("❌ Final Error Message:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Exchange OTP for access token
   */
  async exchangeOTPForToken(
    identifier: string,
    otp: string
  ): Promise<{ success: boolean; data?: TokenData; error?: string }> {
    let baseUrl = "";

    try {
      if (isDemoMode()) {
        if (!/^\d{6}$/.test(otp.trim())) {
          return { success: false, error: "Please enter a 6-digit code" };
        }
        const tokenData: TokenData = {
          token_type: "Bearer",
          access_token: DEMO_ACCESS,
          expires_in: 86400,
          refresh_token: DEMO_REFRESH,
          scope: "demo",
          user: identifier.trim(),
          expires_at: Date.now() + 86400 * 1000,
        };
        await storage.setToken(tokenData.access_token);
        await storage.setItem("refresh_token", tokenData.refresh_token);
        await storage.setItem("token_data", JSON.stringify(tokenData));
        await storage.setItem("user_identifier", identifier.trim());
        logger.info("✅ Demo mode: token stored (any 6-digit OTP accepted)");
        return { success: true, data: tokenData };
      }

      logger.info("🔐 Exchanging OTP for token...");
      logger.info("📧 Identifier:", identifier);
      logger.info("🔢 OTP:", otp);

      const clientId = getClientId();
      logger.info("🔑 Using client_id:", clientId);

      const requestData: OTPExchangeRequest = {
        identifier,
        otp,
        client_id: clientId,
      };

      logger.info("📤 Request data:", JSON.stringify(requestData, null, 2));

      // Use unauthenticated HTTP client for OTP exchange
      const serverConfig = await storage.getItem("serverConfig");
      const config = serverConfig ? JSON.parse(serverConfig) : null;
      baseUrl = config?.serverUrl || "";

      // If no base URL, check the auth store as fallback
      if (!baseUrl) {
        const authStoreConfig = useAuthStore.getState().serverConfig;
        baseUrl = authStoreConfig.serverUrl || "";
        logger.info(
          "⚠️ No server config in storage, using auth store:",
          baseUrl
        );
      }

      if (!baseUrl) {
        throw new Error(
          "No server URL configured. Please configure the server URL in Settings."
        );
      }

      logger.info("🌐 Using base URL for OTP exchange:", baseUrl);
      logger.info(
        "📡 Full URL:",
        `${baseUrl}/api/method/erp_analysis.auth_otp.exchange_otp_for_token`
      );

      // Use axios directly without authentication
      const axios = (await import("axios")).default;
      const response = await axios.post<OTPResponse>(
        `${baseUrl}/api/method/erp_analysis.auth_otp.exchange_otp_for_token`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      logger.info("📥 Response received:", response);

      if (response.data.message) {
        const tokenData: TokenData = {
          ...response.data.message,
          expires_at: Date.now() + response.data.message.expires_in * 1000, // Convert to timestamp
        };

        logger.info("Token data created (secrets redacted)", {
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
          user: tokenData.user,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
        });

        // Store token data securely
        await storage.setToken(tokenData.access_token);
        await storage.setItem("refresh_token", tokenData.refresh_token);
        await storage.setItem("token_data", JSON.stringify(tokenData));
        await storage.setItem("user_identifier", identifier);

        logger.info("💾 Token data stored successfully");
        logger.info("✅ Token exchange successful");
        return { success: true, data: tokenData };
      }

      logger.error("❌ No message in response:", response);
      throw new Error("Invalid response format - no message field");
    } catch (error: any) {
      logger.error("❌ Token exchange failed:", error);
      logger.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Handle specific error cases
      let errorMessage = "Invalid OTP";
      if (error.response?.status === 417) {
        const serverMessage = error.response?.data?._server_messages;
        if (serverMessage && serverMessage.length > 0) {
          try {
            const parsedMessage = JSON.parse(serverMessage[0]);
            errorMessage = parsedMessage.message || "Invalid or expired OTP";
          } catch (e) {
            errorMessage = "Invalid or expired OTP";
          }
        } else {
          errorMessage = "Invalid or expired OTP";
        }
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid OTP format";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error. Please try again.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Refresh access token using refresh token
   * Enhanced with retry logic and better error classification
   */
  async refreshToken(retryCount: number = 0): Promise<{
    success: boolean;
    data?: TokenData;
    error?: string;
    isRecoverable?: boolean; // true if error is temporary (network/server), false if refresh token is invalid
  }> {
    const maxRetries = 3;
    const retryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s

    try {
      const refreshToken = await storage.getItem("refresh_token");
      if (!refreshToken) {
        return {
          success: false,
          error: "No refresh token available",
          isRecoverable: false, // Non-recoverable - user must login again
        };
      }

      logger.info(`🔄 Refreshing access token... (attempt ${retryCount + 1}/${maxRetries + 1})`);

      if (isDemoMode() && refreshToken === DEMO_REFRESH) {
        const userIdentifier =
          (await storage.getItem("user_identifier")) || "";
        const tokenData: TokenData = {
          token_type: "Bearer",
          access_token: DEMO_ACCESS,
          expires_in: 86400,
          refresh_token: DEMO_REFRESH,
          scope: "demo",
          user: userIdentifier,
          expires_at: Date.now() + 86400 * 1000,
        };
        await storage.setToken(tokenData.access_token);
        await storage.setItem("refresh_token", tokenData.refresh_token);
        await storage.setItem("token_data", JSON.stringify(tokenData));
        logger.info("✅ Demo mode: token refreshed locally");
        return { success: true, data: tokenData, isRecoverable: true };
      }

      // Resolve base URL: auth store / http client first (AsyncStorage),
      // then SecureStore — they used to diverge and break refresh.
      let baseUrl = "";
      try {
        const { useAuthStore } = await import("../store/auth");
        baseUrl = (
          useAuthStore.getState().serverConfig?.serverUrl || ""
        ).trim();
      } catch {
        /* store may be unavailable in edge cases */
      }
      if (!baseUrl) {
        try {
          const { http } = await import("./http");
          baseUrl = String(
            (http as any).client?.defaults?.baseURL || ""
          ).trim();
        } catch {
          /* ignore */
        }
      }
      if (!baseUrl) {
        try {
          const AsyncStorage = (
            await import("@react-native-async-storage/async-storage")
          ).default;
          const asyncCfg = await AsyncStorage.getItem("serverConfig");
          if (asyncCfg) {
            const parsed = JSON.parse(asyncCfg);
            baseUrl = String(parsed?.serverUrl || "").trim();
          }
        } catch {
          /* ignore */
        }
      }
      if (!baseUrl) {
        const serverConfig = await storage.getItem("serverConfig");
        const config = serverConfig ? JSON.parse(serverConfig) : null;
        baseUrl = String(config?.serverUrl || "").trim();
      }

      if (!baseUrl) {
        return {
          success: false,
          error: "No server URL configured",
          isRecoverable: false,
        };
      }

      logger.info("🌐 Using base URL for token refresh:", baseUrl);

      // Use axios directly for OAuth2 token refresh with x-www-form-urlencoded
      const axios = (await import("axios")).default;

      // Prepare form data for x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append("grant_type", "refresh_token");
      formData.append("refresh_token", refreshToken);
      formData.append("client_id", getClientId()); // Get client_id from configuration

      const response = await axios.post(
        `${baseUrl}/api/method/frappe.integrations.oauth2.get_token`,
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      logger.info("Token refresh response received", {
        token_type: response.data?.token_type,
        expires_in: response.data?.expires_in,
        access_token: response.data?.access_token,
        refresh_token: response.data?.refresh_token,
      });

      // Handle direct OAuth2 response (no nested message field)
      if (response.data.access_token) {
        const tokenData: TokenData = {
          token_type: response.data.token_type || "Bearer",
          access_token: response.data.access_token,
          expires_in: response.data.expires_in,
          refresh_token: response.data.refresh_token,
          scope: response.data.scope || "all",
          user: "", // Will be populated from stored user identifier
          expires_at: Date.now() + response.data.expires_in * 1000,
        };

        // Get stored user identifier
        const userIdentifier = await storage.getItem("user_identifier");
        if (userIdentifier) {
          tokenData.user = userIdentifier;
        }

        // Update stored token data
        await storage.setToken(tokenData.access_token);
        await storage.setItem("refresh_token", tokenData.refresh_token);
        await storage.setItem("token_data", JSON.stringify(tokenData));

        logger.info("✅ Token refreshed successfully");
        return { success: true, data: tokenData, isRecoverable: true };
      }

      throw new Error("Invalid refresh response format - no access_token");
    } catch (error: any) {
      logger.error(`❌ Token refresh failed (attempt ${retryCount + 1}):`, error);
      logger.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });

      const status = error.response?.status;
      const errorCode = error.code;
      const errorMessageLower = error.message?.toLowerCase() || "";

      // Classify errors
      const isNetworkError = 
        !error.response || 
        errorCode === "ECONNABORTED" || 
        errorCode === "ETIMEDOUT" ||
        errorCode === "ENOTFOUND" ||
        errorCode === "ECONNREFUSED" ||
        errorMessageLower.includes("network") ||
        errorMessageLower.includes("timeout") ||
        errorMessageLower.includes("connection");

      const isServerError = status >= 500 && status < 600;

      const isNonRecoverable = 
        status === 401 || // Unauthorized - refresh token expired/invalid
        status === 400 || // Bad Request - invalid grant/client ID
        (status === 403 && error.response?.data?.error_description?.toLowerCase().includes("invalid")); // Invalid refresh token

      // Determine if error is recoverable
      const isRecoverable = (isNetworkError || isServerError) && !isNonRecoverable;

      // Retry logic for recoverable errors
      if (isRecoverable && retryCount < maxRetries) {
        const delay = retryDelay(retryCount);
        logger.info(`⏳ Retrying token refresh in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.refreshToken(retryCount + 1);
      }

      // Build error message
      let errorMessage = "Token refresh failed";
      if (isNonRecoverable) {
        if (status === 401) {
          errorMessage = "Refresh token expired or invalid";
        } else if (status === 400) {
          errorMessage = "Invalid refresh token or client ID";
        } else {
          errorMessage = error.response?.data?.error_description || "Refresh token is invalid";
        }
      } else if (isNetworkError) {
        errorMessage = "Network error during token refresh";
      } else if (isServerError) {
        errorMessage = "Server error during token refresh";
      } else if (error.response?.data?.error_description) {
        errorMessage = error.response.data.error_description;
      }

      return {
        success: false,
        error: errorMessage,
        isRecoverable: isRecoverable,
      };
    }
  },

  /**
   * Check if token is valid and not expired
   */
  async isTokenValid(): Promise<boolean> {
    try {
      const tokenDataStr = await storage.getItem("token_data");
      if (!tokenDataStr) return false;

      const tokenData: TokenData = JSON.parse(tokenDataStr);
      const now = Date.now();

      // Check if token expires in the next 5 minutes (300000 ms)
      return tokenData.expires_at > now + 300000;
    } catch (error) {
      logger.error("❌ Error checking token validity:", error);
      return false;
    }
  },

  /**
   * Proactively refresh token if it's about to expire (within 5 minutes)
   * This ensures the user stays logged in by refreshing tokens before expiration
   * Returns true if token is valid or refreshed successfully, false otherwise
   */
  async ensureValidToken(): Promise<boolean> {
    try {
      const tokenDataStr = await storage.getItem("token_data");
      if (!tokenDataStr) {
        logger.info("⚠️ No token data found");
        return false;
      }

      const tokenData: TokenData = JSON.parse(tokenDataStr);
      const now = Date.now();
      const expiresBuffer = 5 * 60 * 1000; // 5 minutes

      // If token expires soon, refresh it proactively
      if (tokenData.expires_at <= now + expiresBuffer) {
        logger.info("🔄 Token expires soon, refreshing proactively...");
        const refreshResult = await this.refreshToken();
        
        if (refreshResult.success) {
          logger.info("✅ Token refreshed proactively");
          return true;
        }

        // If refresh failed but is recoverable, token might still be valid for now
        if (refreshResult.isRecoverable) {
          logger.info("⚠️ Proactive refresh failed (recoverable), token may still be valid");
          // Check if current token is still valid
          return tokenData.expires_at > now;
        }

        // Non-recoverable error - token is invalid
        logger.info("❌ Proactive refresh failed (non-recoverable)");
        return false;
      }

      // Token is still valid
      return true;
    } catch (error) {
      logger.error("❌ Error ensuring valid token:", error);
      return false;
    }
  },

  /**
   * Get current access token for API calls
   */
  async getValidToken(): Promise<string | null> {
    try {
      // Get access token for API calls
      const accessToken = await storage.getToken();

      if (accessToken) {
        logger.info("🔑 Using access token for API calls");
        return accessToken;
      }

      logger.info("⚠️ No valid access token found");
      return null;
    } catch (error) {
      logger.error("❌ Error getting valid token:", error);
      return null;
    }
  },

  /**
   * Logout - clear all stored tokens
   */
  async logout(): Promise<void> {
    try {
      // Clear all stored authentication data
      await storage.clear();
      await storage.removeItem("refresh_token");
      await storage.removeItem("token_data");
      await storage.removeItem("user_identifier");

      logger.info("✅ OAuth logout completed");
    } catch (error) {
      logger.error("❌ Logout error:", error);
    }
  },

  /**
   * Get current user identifier
   */
  async getCurrentUser(): Promise<string | null> {
    return await storage.getItem("user_identifier");
  },
};
