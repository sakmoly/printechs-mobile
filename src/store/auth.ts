import { create } from "zustand";
import type { LoginCredentials } from "../api/auth";
import { oauthApi } from "../api/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "../api/storage";
import { http } from "../api/http";
import type { TokenData } from "../api/oauth";
import {
  getMyAccess,
  clearMyAccessCache,
  type AccessPermissionScope,
  type AccessObjectPermission,
} from "../api/permissions";
import { isDemoMode } from "../api/demoMode";
import { shouldUseMockData } from "../api/mock";
import {
  DEFAULT_MOBILE_CONFIG,
  fetchMobileConfig,
  type MobileConfig,
} from "../api/mobileConfig";
import { logger } from "../utils/logger";
import { useBootstrapStore } from "./bootstrap";
import { normalizeAccessScope, asTruthyFlag } from "../api/accessScope";
import { normalizeServerUrl } from "../api/serverUrl";

function applyNormalizedServerUrl(config: ServerConfig): ServerConfig {
  if (!config?.serverUrl) return config;
  const normalized = normalizeServerUrl(config.serverUrl);
  if (!normalized.remapped && normalized.url === config.serverUrl) {
    return config;
  }
  if (normalized.remapped) {
    console.warn("⚠️ Stored server URL healed:", normalized.note);
  }
  let hostname = config.hostname;
  let port = config.port;
  let isHttps = config.isHttps;
  try {
    const u = new URL(normalized.url);
    hostname = u.hostname;
    port = u.port
      ? Number(u.port)
      : u.protocol === "https:"
        ? 443
        : 80;
    isHttps = u.protocol === "https:";
  } catch {
    /* keep existing host fields */
  }
  return {
    ...config,
    serverUrl: normalized.url,
    hostname,
    port,
    isHttps,
  };
}

export interface ServerConfig {
  serverUrl: string;
  hostname: string;
  port: number;
  isHttps: boolean;
  clientId?: string; // Optional client_id for OAuth
}

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  isLoading: boolean;
  error: string | null;
  serverConfig: ServerConfig;
  permissions: MenuPermissionState;
  mobileConfig: MobileConfig;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateServerConfig: (config: Partial<ServerConfig>) => void;
  loadServerConfig: () => Promise<void>;
  saveServerConfig: (config: ServerConfig) => Promise<void>;
  loadPermissions: (overrideScope?: Partial<AccessPermissionScope>) => Promise<void>;
  loadMobileConfig: () => Promise<void>;
  resetPermissions: () => void;
}

interface MenuPermissionState {
  fetched: boolean;
  menus: Record<string, boolean>;
  raw: AccessObjectPermission[];
  scope?: AccessPermissionScope;
}

export type { MenuPermissionState };

/**
 * Menu visibility from Access Profile (`get_my_access`).
 *
 * - Before fetch: allow (avoid blank UI on cold start)
 * - After fetch: explicit `can_view: false` hides
 * - Missing key: allow (BA may not list every AO code) — BA should return
 *   denied Menu rows with `can_view: false` for hide-to-work
 */
export function canAccessMenuObject(
  permissions: MenuPermissionState,
  objectKey: string
): boolean {
  if (!permissions.fetched) return true;
  if (!objectKey) return true;
  if (Object.prototype.hasOwnProperty.call(permissions.menus, objectKey)) {
    return permissions.menus[objectKey] === true;
  }
  return true;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  serverConfig: {
    serverUrl: "",
    hostname: "",
    port: 8000,
    isHttps: true,
    clientId: "", // Will be auto-retrieved from server
  },
  permissions: {
    fetched: false,
    menus: {},
    raw: [],
    scope: undefined,
  },
  mobileConfig: DEFAULT_MOBILE_CONFIG,

  login: async (credentials) => {
    console.log("🏪 AUTH STORE - Login called with:", credentials);
    set({ isLoading: true, error: null });

    // Update HTTP client with server configuration before login
    const currentConfig = get().serverConfig;
    console.log("🔧 Current server config:", currentConfig);

    if (currentConfig.serverUrl) {
      http.setBaseUrl(currentConfig.serverUrl);
      console.log(
        "🌐 HTTP client base URL updated to:",
        currentConfig.serverUrl
      );
      http.setUnauthorizedHandler(async () => {
        console.log("🔒 Unauthorized response detected during session, logging out");
        await get().logout();
      });
    }

    // For OAuth, we don't need to call authApi.login since OAuth handles authentication
    // Just create user data from the email/username
    const serverUrl = get().serverConfig.serverUrl;

    // Extract domain from server URL for email construction
    let emailDomain = "printechs.com"; // Default fallback
    try {
      if (serverUrl) {
        const url = new URL(serverUrl);
        emailDomain = url.hostname.replace(/^www\./, ""); // Remove www. prefix if present
      }
    } catch (e) {
      console.log("Could not parse server URL for email domain, using default");
    }

    const userEmail = credentials.usr.includes("@")
      ? credentials.usr
      : `${credentials.usr}@${emailDomain}`;

    // Do not hardcode a specific user's image; leave empty to allow UI fallback
    let userImage: string | null = null;

    console.log("=== AUTH STORE - OAuth Login ===");
    console.log("User email:", userEmail);
    console.log("Server URL:", serverUrl);
    console.log("User image:", userImage);
    console.log("==========================================");

    const enrichedUser = {
      username: credentials.usr,
      full_name: credentials.usr.split("@")[0], // Use part before @ as name
      email: userEmail,
      mobile_no: null,
      designation: "User",
      department: "General",
      company: "Printechs",
      image: userImage || "",
      user_image: userImage || "",
      photo_url: userImage || "",
      home_page: "/app",
    };

    console.log("👤 Enriched user data:", enrichedUser);

    try {
      await storage.setUser(enrichedUser);
    } catch (error) {
      console.warn("⚠️ Failed to persist user profile:", error);
    }

    set({ isAuthenticated: true, user: enrichedUser, isLoading: true });
    await get().loadMobileConfig();
    await get().loadPermissions();
    set({ isLoading: false });

    console.log("✅ AUTH STORE - Login completed successfully");
    return true;
  },

  logout: async () => {
    set({ isLoading: true });
    const currentConfig = get().serverConfig;
    if (currentConfig?.serverUrl) {
      http.setBaseUrl(currentConfig.serverUrl);
    }

    if (!isDemoMode()) {
      const username =
        get().user?.username ||
        get().user?.email ||
        (typeof get().user?.user === "string" ? get().user?.user : undefined);
      if (username) {
        try {
          await clearMyAccessCache(username);
        } catch (error) {
          // Ignore silently
        }
      } else {
        try {
          await clearMyAccessCache();
        } catch (error) {
          // Ignore silently
        }
      }
    }

    await oauthApi.logout();
    try {
      await storage.removeUser();
    } catch (error) {
      console.warn("⚠️ Failed to clear stored user:", error);
    }
    get().resetPermissions();
    useBootstrapStore.getState().clearBootstrap();
    set({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      mobileConfig: DEFAULT_MOBILE_CONFIG,
    });
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });

      // Ensure server configuration is loaded before auth checks
      await get().loadServerConfig();
      const currentConfig = get().serverConfig;

      if (currentConfig?.serverUrl) {
        http.setBaseUrl(currentConfig.serverUrl);
      }

      // Try to restore persisted user profile
      let storedUser = null;
      try {
        storedUser = await storage.getUser();
      } catch (error) {
        console.warn("⚠️ Failed to load stored user:", error);
      }

      // Retrieve stored token data if available
      const tokenDataRaw = await storage.getItem("token_data");
      if (!tokenDataRaw) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      let tokenData: TokenData;
      try {
        tokenData = JSON.parse(tokenDataRaw) as TokenData;
      } catch (error) {
        logger.warn("Invalid token data in storage, clearing session");
        await oauthApi.logout();
        await storage.removeUser().catch(() => {});
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      const now = Date.now();
      const expiresBuffer = 5 * 60 * 1000; // 5 minutes

      // Refresh token if it's expired or about to expire soon
      if (!tokenData.expires_at || tokenData.expires_at <= now + expiresBuffer) {
        const refreshResult = await oauthApi.refreshToken();
        
        // Only logout if refresh token itself is invalid/expired (non-recoverable error)
        // Keep user logged in for temporary errors (network/server issues)
        if (!refreshResult.success) {
          // Check if error is non-recoverable (refresh token invalid/expired)
          const isNonRecoverable = 
            refreshResult.isRecoverable === false ||
            refreshResult.error?.toLowerCase().includes("invalid") ||
            refreshResult.error?.toLowerCase().includes("expired") ||
            refreshResult.error?.includes("401") ||
            refreshResult.error?.includes("400");
          
          if (isNonRecoverable) {
            // Refresh token is invalid - user must login again
            logger.info("Refresh token is invalid/expired - logging out");
            await oauthApi.logout();
            await storage.removeUser().catch(() => {});
            set({ isAuthenticated: false, user: null, isLoading: false });
            return;
          } else {
            // Temporary error (network/server) - keep user logged in
            // Token refresh will retry later when making API calls
            logger.info("Temporary refresh failure (recoverable), keeping user logged in");
            // Check if current token is still valid for now
            if (tokenData.expires_at && tokenData.expires_at > now) {
              logger.info("Current token is still valid, continuing with existing token");
              // Continue with existing token
            } else {
              // Token is expired but refresh failed temporarily
              // Still keep user logged in - HTTP interceptor will retry on next API call
              logger.info("Token expired but refresh failed temporarily - user stays logged in, will retry on next API call");
            }
          }
        } else if (refreshResult.data) {
          // Token refreshed successfully
          tokenData = refreshResult.data;
          logger.info("Token refreshed successfully in checkAuth");
        }
      }

      // Ensure we have a user object
      if (!storedUser) {
        const identifier =
          tokenData.user || (await storage.getItem("user_identifier"));
        if (identifier) {
          const namePart = identifier.split("@")[0];
          storedUser = {
            username: identifier,
            full_name: namePart,
            email: identifier,
            designation: "User",
            department: "General",
            company: "Printechs",
            image: currentConfig?.serverUrl
              ? `${currentConfig.serverUrl}/files/Sakeer.png`
              : null,
            user_image: currentConfig?.serverUrl
              ? `${currentConfig.serverUrl}/files/Sakeer.png`
              : null,
            photo_url: currentConfig?.serverUrl
              ? `${currentConfig.serverUrl}/files/Sakeer.png`
              : null,
            home_page: "/app",
          };
          await storage.setUser(storedUser).catch(() => {});
        }
      }

      // Sanitize any legacy hardcoded image to avoid showing the wrong photo
      if (storedUser) {
        const imgFields = ["image", "user_image", "photo_url"] as const;
        let mutated = false;
        for (const k of imgFields) {
          const v = storedUser[k];
          if (typeof v === "string" && /Sakeer\.png$/i.test(v)) {
            storedUser[k] = "";
            mutated = true;
          }
        }
        if (mutated) {
          try {
            await storage.setUser(storedUser);
          } catch {}
        }
      }

      if (!storedUser) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      http.setUnauthorizedHandler(async () => {
        console.log("🔒 Unauthorized response detected, logging out user");
        await get().logout();
      });

      set({
        isAuthenticated: true,
        user: storedUser,
        error: null,
      });
      await get().loadMobileConfig();
      await get().loadPermissions();
      set({ isLoading: false });
    } catch (error) {
      console.error("Auth check error:", error);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  },

  clearError: () => set({ error: null }),

  updateServerConfig: async (config: Partial<ServerConfig>) => {
    const currentConfig = get().serverConfig;
    const newConfig = applyNormalizedServerUrl({
      ...currentConfig,
      ...config,
    });

    const urlChanged =
      (currentConfig.serverUrl || "") !== (newConfig.serverUrl || "");

    set({ serverConfig: newConfig });
    if (newConfig.serverUrl) {
      http.setBaseUrl(newConfig.serverUrl);
    }

    try {
      await AsyncStorage.setItem("serverConfig", JSON.stringify(newConfig));
    } catch (error) {
      console.error("Failed to save server config:", error);
    }

    // Re-fetch tenant bootstrap when the ERP site URL changes
    if (urlChanged && get().isAuthenticated) {
      useBootstrapStore.getState().clearBootstrap();
      await get().loadMobileConfig();
      await get().loadPermissions();
    }
  },

  saveServerConfig: async (config: ServerConfig) => {
    const previousUrl = get().serverConfig.serverUrl || "";
    const newConfig = applyNormalizedServerUrl(config);
    set({ serverConfig: newConfig });
    http.setBaseUrl(newConfig.serverUrl || "");
    try {
      await AsyncStorage.setItem("serverConfig", JSON.stringify(newConfig));
    } catch (error) {
      console.error("Failed to save server config:", error);
    }
    if (
      previousUrl !== (newConfig.serverUrl || "") &&
      get().isAuthenticated
    ) {
      useBootstrapStore.getState().clearBootstrap();
      await get().loadMobileConfig();
      await get().loadPermissions();
    }
  },

  loadServerConfig: async () => {
    try {
      const savedConfig = await AsyncStorage.getItem("serverConfig");
      if (savedConfig) {
        const config = applyNormalizedServerUrl(JSON.parse(savedConfig));
        set({ serverConfig: config });
        if (config.serverUrl) {
          http.setBaseUrl(config.serverUrl);
        }
        // Persist healed URL so erp.printechs.com doesn't stick around
        if (config.serverUrl) {
          await AsyncStorage.setItem("serverConfig", JSON.stringify(config));
        }
      }
    } catch (error) {
      console.error("Failed to load server config:", error);
      // Set default config if loading fails
      set({
        serverConfig: {
          serverUrl: "",
          hostname: "",
          port: 8000,
          isHttps: true,
          clientId: "", // Will be auto-retrieved from server
        },
      });
    }
  },

  loadPermissions: async (overrideScope) => {
    try {
      if (shouldUseMockData()) {
        set({
          permissions: {
            fetched: true,
            menus: {},
            raw: [],
            scope: undefined,
          },
        });
        console.log("🔐 Mock/demo mode: skipping server permissions");
        return;
      }

      const user = get().user;
      console.log("🔐 Loading permissions for user:", user?.username);
      const defaultScope: Partial<AccessPermissionScope> = {
        ...overrideScope,
      };

      let result = await getMyAccess(defaultScope, get().mobileConfig);
      let profiles = result.profiles;
      let resolvedScope = normalizeAccessScope(result.scope ?? defaultScope);

      console.log("✅ Permissions fetched:", {
        count: profiles.length,
        scope: resolvedScope,
        viewTerritories: resolvedScope.view_territories,
        approveTerritories: resolvedScope.approve_territories,
        allowViewAllSales: resolvedScope.allow_view_all_sales,
      });

      // If nothing matched, retry with inferred scope (e.g. branch/territory defaults)
      if (!profiles.length) {
        const fallbackScope: Partial<AccessPermissionScope> = {
          ...defaultScope,
        };

        if (!fallbackScope.company && resolvedScope?.company) {
          fallbackScope.company = resolvedScope.company;
        }
        if (!fallbackScope.branch && resolvedScope?.branch) {
          fallbackScope.branch = resolvedScope.branch;
        }
        if (!fallbackScope.territory) {
          if (resolvedScope?.territory) {
            fallbackScope.territory = resolvedScope.territory;
          } else if (resolvedScope?.branch) {
            fallbackScope.territory = resolvedScope.branch;
          }
        }

        const hasFallbackOverride =
          JSON.stringify(fallbackScope) !== JSON.stringify(defaultScope);

        if (hasFallbackOverride) {
          console.log("🔄 Retry permissions with scope:", fallbackScope);
          result = await getMyAccess(fallbackScope, get().mobileConfig);
          profiles = result.profiles;
          resolvedScope = normalizeAccessScope(
            result.scope ?? fallbackScope
          );
          console.log("✅ Permissions fetched (retry):", {
            count: profiles.length,
            scope: resolvedScope,
            viewTerritories: resolvedScope.view_territories,
            approveTerritories: resolvedScope.approve_territories,
          });
        }
      }

      const menus: Record<string, boolean> = {};
      for (const item of profiles) {
        const key = String(item.object_key || "").trim();
        if (!key) continue;
        const type = String(item.object_type || "").trim().toLowerCase();
        const view = asTruthyFlag(item.can_view);
        if (type === "menu") {
          // Menu is authoritative for UI; if already set false, keep deny
          if (menus[key] === false) continue;
          menus[key] = view;
        } else if (type === "api") {
          // Deny wins if either Menu or API says false
          if (menus[key] === false) continue;
          if (!(key in menus)) menus[key] = view;
          else if (!view) menus[key] = false;
        }
      }

      set({
        permissions: {
          fetched: true,
          menus,
          raw: profiles,
          scope: resolvedScope,
        },
      });
      if (__DEV__) {
        const denied = Object.entries(menus)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        console.log("🧭 Menu permissions map:", menus);
        console.log("🧭 Denied AO keys:", denied);
        const c360 = profiles.filter((p) =>
          /customer\s*360|get_customer_360|search_customers/i.test(
            `${p.label || ""} ${p.object_key || ""}`
          )
        );
        console.log(
          "🧭 Customer 360 related AOs:",
          c360.map((p) => ({
            key: p.object_key,
            label: p.label,
            type: p.object_type,
            can_view: p.can_view,
          }))
        );
      } else {
        console.log("🧭 Menu permissions map:", menus);
      }
    } catch (error) {
      console.warn("⚠️ Failed to load permissions:", error);
      set({
        permissions: {
          fetched: true,
          menus: {},
          raw: [],
          scope: undefined,
        },
      });
    }
  },

  loadMobileConfig: async () => {
    try {
      // Prefer get_mobile_bootstrap; falls back to get_mobile_config inside fetch
      const result = await useBootstrapStore.getState().loadBootstrap();
      if (result?.mobileConfig) {
        set({ mobileConfig: result.mobileConfig });
        logger.info("Mobile config synced from bootstrap", {
          source: result.bootstrap.source,
          business_type: result.bootstrap.context.business_type,
          version: result.mobileConfig.version,
        });
        return;
      }
      const config = await fetchMobileConfig();
      set({ mobileConfig: config });
    } catch (error) {
      logger.warn("Failed to load mobile config/bootstrap", error);
      set({ mobileConfig: DEFAULT_MOBILE_CONFIG });
    }
  },

  resetPermissions: () =>
    set({
      permissions: { fetched: false, menus: {}, raw: [], scope: undefined },
    }),
}));
