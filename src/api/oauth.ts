import { http } from "./http";
import { storage } from "./storage";
import { useAuthStore } from "../store/auth";

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
   * Request OTP for authentication
   */
  async requestOTP(
    identifier: string,
    channel: "email" | "sms" = "email"
  ): Promise<{ success: boolean; error?: string }> {
    let config: any = null;
    let baseUrl = "";

    try {
      console.log("📧 Requesting OTP for:", identifier);

      const clientId = getClientId();
      console.log("🔑 Using client_id:", clientId);

      const requestData: OTPRequest = {
        identifier,
        client_id: clientId,
        channel,
      };

      console.log("📤 Request Data:", JSON.stringify(requestData, null, 2));

      // Create a simple unauthenticated HTTP client for OTP request
      const serverConfig = await storage.getItem("serverConfig");
      config = serverConfig ? JSON.parse(serverConfig) : null;
      baseUrl = config?.serverUrl || "";

      // If no base URL, check the auth store as fallback
      if (!baseUrl) {
        const authStoreConfig = useAuthStore.getState().serverConfig;
        baseUrl = authStoreConfig.serverUrl || "";
        console.log(
          "⚠️ No server config in storage, using auth store:",
          baseUrl
        );
      }

      if (!baseUrl) {
        throw new Error(
          "No server URL configured. Please configure the server URL in Settings."
        );
      }

      console.log("🌐 Using base URL:", baseUrl);
      console.log(
        "📡 Full URL:",
        `${baseUrl}/api/method/printechs_utility.auth_otp.request_otp`
      );

      // Use axios directly without authentication
      const axios = (await import("axios")).default;
      const response = await axios.post(
        `${baseUrl}/api/method/printechs_utility.auth_otp.request_otp`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("✅ OTP request successful");
      console.log("📥 Response:", response.data);
      return { success: true };
    } catch (error: any) {
      console.error("❌ OTP request failed:", error);
      console.error("❌ Error details:", {
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

      console.error("❌ Final Error Message:", errorMessage);
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
      console.log("🔐 Exchanging OTP for token...");
      console.log("📧 Identifier:", identifier);
      console.log("🔢 OTP:", otp);

      const clientId = getClientId();
      console.log("🔑 Using client_id:", clientId);

      const requestData: OTPExchangeRequest = {
        identifier,
        otp,
        client_id: clientId,
      };

      console.log("📤 Request data:", JSON.stringify(requestData, null, 2));

      // Use unauthenticated HTTP client for OTP exchange
      const serverConfig = await storage.getItem("serverConfig");
      const config = serverConfig ? JSON.parse(serverConfig) : null;
      baseUrl = config?.serverUrl || "";

      // If no base URL, check the auth store as fallback
      if (!baseUrl) {
        const authStoreConfig = useAuthStore.getState().serverConfig;
        baseUrl = authStoreConfig.serverUrl || "";
        console.log(
          "⚠️ No server config in storage, using auth store:",
          baseUrl
        );
      }

      if (!baseUrl) {
        throw new Error(
          "No server URL configured. Please configure the server URL in Settings."
        );
      }

      console.log("🌐 Using base URL for OTP exchange:", baseUrl);
      console.log(
        "📡 Full URL:",
        `${baseUrl}/api/method/printechs_utility.auth_otp.exchange_otp_for_token`
      );

      // Use axios directly without authentication
      const axios = (await import("axios")).default;
      const response = await axios.post<OTPResponse>(
        `${baseUrl}/api/method/printechs_utility.auth_otp.exchange_otp_for_token`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("📥 Response received:", response);

      if (response.data.message) {
        const tokenData: TokenData = {
          ...response.data.message,
          expires_at: Date.now() + response.data.message.expires_in * 1000, // Convert to timestamp
        };

        console.log("🔑 Token data created:", tokenData);

        // Store token data securely
        await storage.setToken(tokenData.access_token);
        await storage.setItem("refresh_token", tokenData.refresh_token);
        await storage.setItem("token_data", JSON.stringify(tokenData));
        await storage.setItem("user_identifier", identifier);

        console.log("💾 Token data stored successfully");
        console.log("✅ Token exchange successful");
        return { success: true, data: tokenData };
      }

      console.error("❌ No message in response:", response);
      throw new Error("Invalid response format - no message field");
    } catch (error: any) {
      console.error("❌ Token exchange failed:", error);
      console.error("❌ Error details:", {
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

      console.log(`🔄 Refreshing access token... (attempt ${retryCount + 1}/${maxRetries + 1})`);

      // Get server config for base URL
      const serverConfig = await storage.getItem("serverConfig");
      const config = serverConfig ? JSON.parse(serverConfig) : null;
      const baseUrl = config?.serverUrl || "";

      if (!baseUrl) {
        return {
          success: false,
          error: "No server URL configured",
          isRecoverable: false,
        };
      }

      console.log("🌐 Using base URL for token refresh:", baseUrl);

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

      console.log("📥 Token refresh response:", response.data);

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

        console.log("✅ Token refreshed successfully");
        return { success: true, data: tokenData, isRecoverable: true };
      }

      throw new Error("Invalid refresh response format - no access_token");
    } catch (error: any) {
      console.error(`❌ Token refresh failed (attempt ${retryCount + 1}):`, error);
      console.error("❌ Error details:", {
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
        console.log(`⏳ Retrying token refresh in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
        
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
      console.error("❌ Error checking token validity:", error);
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
        console.log("⚠️ No token data found");
        return false;
      }

      const tokenData: TokenData = JSON.parse(tokenDataStr);
      const now = Date.now();
      const expiresBuffer = 5 * 60 * 1000; // 5 minutes

      // If token expires soon, refresh it proactively
      if (tokenData.expires_at <= now + expiresBuffer) {
        console.log("🔄 Token expires soon, refreshing proactively...");
        const refreshResult = await this.refreshToken();
        
        if (refreshResult.success) {
          console.log("✅ Token refreshed proactively");
          return true;
        }

        // If refresh failed but is recoverable, token might still be valid for now
        if (refreshResult.isRecoverable) {
          console.log("⚠️ Proactive refresh failed (recoverable), token may still be valid");
          // Check if current token is still valid
          return tokenData.expires_at > now;
        }

        // Non-recoverable error - token is invalid
        console.log("❌ Proactive refresh failed (non-recoverable)");
        return false;
      }

      // Token is still valid
      return true;
    } catch (error) {
      console.error("❌ Error ensuring valid token:", error);
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
        console.log("🔑 Using access token for API calls");
        return accessToken;
      }

      console.log("⚠️ No valid access token found");
      return null;
    } catch (error) {
      console.error("❌ Error getting valid token:", error);
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

      console.log("✅ OAuth logout completed");
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
  },

  /**
   * Get current user identifier
   */
  async getCurrentUser(): Promise<string | null> {
    return await storage.getItem("user_identifier");
  },
};
