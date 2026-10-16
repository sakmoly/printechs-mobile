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
import { useDashboardFiltersStore } from "./dashboardFilters";
import { normalizeAccessScope, asTruthyFlag } from "../api/accessScope";
import { normalizeServerUrl } from "../api/serverUrl";
import {
  buildSessionUserKey,
  hydrateAllDashboardBoards,
  setActiveSessionUserKey,
} from "../api/sessionCache";
import { defaultPeriod } from "../utils/period";
import { resolveCompanyName } from "../api/apiResilience";

function applyNormalizedServerUrl(config: ServerConfig): ServerConfig {
  if (!config?.serverUrl) return config;
  const normalized = normalizeServerUrl(config.serverUrl);
  if (!normalized.remapped && normalized.url === config.serverUrl) {
    return config;
  }
  if (normalized.remapped) {
    logger.debug("Stored server URL healed:", normalized.note);
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
    logger.debug("AUTH STORE - Login");
    set({ isLoading: true, error: null });

    // Update HTTP client with server configuration before login
    const currentConfig = get().serverConfig;
    logger.debug("Current server config loaded");

    if (currentConfig.serverUrl) {
      http.setBaseUrl(currentConfig.serverUrl);
      http.setUnauthorizedHandler(async () => {
        logger.debug("Unauthorized response during session, logging out");
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
    } catch {
      logger.debug("Could not parse server URL for email domain, using default");
    }

    const userEmail = credentials.usr.includes("@")
      ? credentials.usr
      : `${credentials.usr}@${emailDomain}`;

    // Do not hardcode a specific user's image; leave empty to allow UI fallback
    let userImage: string | null = null;

    logger.debug("OAuth login", { userEmail, serverUrl });

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

    try {
      await storage.setUser(enrichedUser);
    } catch (error) {
      logger.error("Failed to persist user profile:", error);
    }

    set({ isAuthenticated: true, user: enrichedUser, isLoading: true });
    await get().loadMobileConfig();
    await get().loadPermissions();
    set({ isLoading: false });

    logger.debug("AUTH STORE - Login completed");
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
      logger.error("Failed to clear stored user:", error);
    }
    get().resetPermissions();
    useBootstrapStore.getState().clearBootstrap();
    useDashboardFiltersStore.getState().reset();
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
        logger.error("Failed to load stored user:", error);
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

      // Ensure we have a user object before hydrate (no network)
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
            image: null,
            user_image: null,
            photo_url: null,
            home_page: "/app",
          };
          await storage.setUser(storedUser).catch(() => {});
        }
      }

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

      const userKey = buildSessionUserKey({
        username:
          storedUser.username ||
          (typeof storedUser.user === "string" ? storedUser.user : null) ||
          storedUser.email,
        email: storedUser.email,
        serverUrl: get().serverConfig.serverUrl,
      });
      setActiveSessionUserKey(userKey);

      // Fast path: paint from disk BEFORE token refresh / bootstrap network
      const hydrated = await useBootstrapStore
        .getState()
        .hydrateFromCache(userKey);
      if (hydrated) {
        const period = defaultPeriod();
        const companyEarly = resolveCompanyName(
          undefined,
          storedUser?.company,
          useBootstrapStore.getState().bootstrap?.context?.company
        );
        if (companyEarly) {
          await hydrateAllDashboardBoards(userKey, companyEarly, period);
        }
        http.setUnauthorizedHandler(async () => {
          logger.debug("Unauthorized response detected, logging out user");
          await get().logout();
        });
        set({
          isAuthenticated: true,
          user: storedUser,
          error: null,
          isLoading: false,
        });
        logger.info("Fast start from session cache — refreshing in background");
        void (async () => {
          try {
            const nowBg = Date.now();
            const expiresBufferBg = 5 * 60 * 1000;
            if (
              !tokenData.expires_at ||
              tokenData.expires_at <= nowBg + expiresBufferBg
            ) {
              const refreshResult = await oauthApi.refreshToken();
              if (
                !refreshResult.success &&
                (refreshResult.isRecoverable === false ||
                  refreshResult.error?.toLowerCase().includes("invalid") ||
                  refreshResult.error?.toLowerCase().includes("expired") ||
                  refreshResult.error?.includes("401") ||
                  refreshResult.error?.includes("400"))
              ) {
                await get().logout();
                return;
              }
            }
            await get().loadMobileConfig();
            await get().loadPermissions();
          } catch (e) {
            logger.warn("Background session refresh failed", e);
          }
        })();
        return;
      }

      const now = Date.now();
      const expiresBuffer = 5 * 60 * 1000;

      // Cold start: refresh token then load bootstrap (blocking)
      if (!tokenData.expires_at || tokenData.expires_at <= now + expiresBuffer) {
        const refreshResult = await oauthApi.refreshToken();

        if (!refreshResult.success) {
          const isNonRecoverable =
            refreshResult.isRecoverable === false ||
            refreshResult.error?.toLowerCase().includes("invalid") ||
            refreshResult.error?.toLowerCase().includes("expired") ||
            refreshResult.error?.includes("401") ||
            refreshResult.error?.includes("400");

          if (isNonRecoverable) {
            logger.info("Refresh token is invalid/expired - logging out");
            await oauthApi.logout();
            await storage.removeUser().catch(() => {});
            set({ isAuthenticated: false, user: null, isLoading: false });
            return;
          } else {
            logger.info(
              "Temporary refresh failure (recoverable), keeping user logged in"
            );
          }
        } else if (refreshResult.data) {
          tokenData = refreshResult.data;
          logger.info("Token refreshed successfully in checkAuth");
        }
      }

      http.setUnauthorizedHandler(async () => {
        logger.debug("Unauthorized response detected, logging out user");
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
        logger.debug("Mock/demo mode: skipping server permissions");
        return;
      }

      const user = get().user;
      logger.debug("Loading permissions", { user: user?.username });
      const defaultScope: Partial<AccessPermissionScope> = {
        ...overrideScope,
      };

      let result = await getMyAccess(defaultScope, get().mobileConfig);
      let profiles = result.profiles;
      let resolvedScope = normalizeAccessScope(result.scope ?? defaultScope);

      logger.debug("Permissions fetched", {
        count: profiles.length,
        scope: resolvedScope,
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
          logger.debug("Retry permissions with scope", fallbackScope);
          result = await getMyAccess(fallbackScope, get().mobileConfig);
          profiles = result.profiles;
          resolvedScope = normalizeAccessScope(
            result.scope ?? fallbackScope
          );
          logger.debug("Permissions fetched (retry)", {
            count: profiles.length,
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
    } catch (error) {
      logger.error("Failed to load permissions:", error);
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
      const user = get().user;
      const userKey = buildSessionUserKey({
        username:
          user?.username ||
          (typeof user?.user === "string" ? user.user : null) ||
          user?.email,
        email: user?.email,
        serverUrl: get().serverConfig.serverUrl,
      });
      setActiveSessionUserKey(userKey);

      const result = await useBootstrapStore
        .getState()
        .loadBootstrap(userKey);
      if (result?.mobileConfig) {
        set({ mobileConfig: result.mobileConfig });
        logger.info("Mobile config synced from bootstrap", {
          source: result.bootstrap.source,
          business_type: result.bootstrap.context.business_type,
          version: result.mobileConfig.version,
          fromCache: useBootstrapStore.getState().fromCache,
        });
        const period = defaultPeriod();
        const company =
          resolveCompanyName(
            get().permissions.scope?.company,
            user?.company,
            result.bootstrap.context?.company
          ) || undefined;
        if (company) {
          void hydrateAllDashboardBoards(
            userKey,
            String(company),
            period
          );
        }
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
