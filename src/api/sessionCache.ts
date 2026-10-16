/**
 * Disk cache for bootstrap layout + board widget batches (stale-while-revalidate).
 * Scoped by user + server so sessions never cross-contaminate.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MobileBootstrap } from "../types/bootstrap";
import type { DashboardBoardDataResponse } from "./dashboardBoardData";
import type { DashboardWidgetDataResponse } from "./dashboardWidgetData";
import { DASHBOARD_BOARD_IDS } from "../constants/dashboardBoards";
import type { DateRange } from "../utils/period";
import { logger } from "../utils/logger";

/** Bump when board/widget payload semantics change (e.g. territory-scoped Sales GP/COGS). */
const VERSION = 4;
const BOOTSTRAP_PREFIX = "@printechs/cache/bootstrap/v4:";
const BOARD_PREFIX = "@printechs/cache/board/v4:";
const WIDGET_PREFIX = "@printechs/cache/widget/v4:";

/** Layout can be older; still refresh in background */
export const BOOTSTRAP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Show last board numbers up to 24h (revalidate in background via React Query) */
export const BOARD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WIDGET_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Envelope<T> = {
  version: number;
  userKey: string;
  savedAt: number;
  payload: T;
};

type BoardMemoryEntry = {
  savedAt: number;
  data: DashboardBoardDataResponse;
};

const boardMemory = new Map<string, BoardMemoryEntry>();
const widgetMemory = new Map<string, BoardMemoryEntry>();
let activeUserKey: string | null = null;

export function buildSessionUserKey(opts: {
  username?: string | null;
  email?: string | null;
  serverUrl?: string | null;
}): string {
  const user = String(opts.username || opts.email || "anon")
    .trim()
    .toLowerCase();
  let host = "local";
  try {
    if (opts.serverUrl) {
      host = new URL(opts.serverUrl).host.replace(/^www\./, "");
    }
  } catch {
    host = String(opts.serverUrl || "local").slice(0, 64);
  }
  return `${host}::${user}`;
}

export function setActiveSessionUserKey(userKey: string | null) {
  activeUserKey = userKey;
}

export function getActiveSessionUserKey(): string | null {
  return activeUserKey;
}

function bootstrapKey(userKey: string) {
  return `${BOOTSTRAP_PREFIX}${userKey}`;
}

/**
 * Rolling periods (ytd/mtd/qtd): ignore to_date so yesterday's cache still paints today.
 * Company is required in the key — fetching without company returns zeros.
 */
function boardStorageKey(
  userKey: string,
  dashboardId: string,
  company: string,
  from: string,
  period: string,
  territory?: string
) {
  const p = String(period || "ytd").toLowerCase();
  const companyPart = String(company || "")
    .trim()
    .toLowerCase();
  const territoryPart = String(territory || "")
    .trim()
    .toLowerCase();
  return `${BOARD_PREFIX}${userKey}|${dashboardId || "home"}|${companyPart}|${p}|${from || ""}|${territoryPart}`;
}

function widgetStorageKey(
  userKey: string,
  widgetKey: string,
  company: string,
  from: string,
  period: string,
  territory?: string,
  showLy?: boolean
) {
  const p = String(period || "ytd").toLowerCase();
  const companyPart = String(company || "")
    .trim()
    .toLowerCase();
  const territoryPart = String(territory || "")
    .trim()
    .toLowerCase();
  const widgetPart = String(widgetKey || "")
    .trim()
    .toLowerCase();
  return `${WIDGET_PREFIX}${userKey}|${widgetPart}|${companyPart}|${p}|${from || ""}|${territoryPart}|${showLy ? 1 : 0}`;
}

function widgetCandidateKeys(opts: {
  userKey: string;
  widget_key: string;
  company?: string;
  from_date?: string;
  period?: string;
  territory?: string;
  show_ly?: boolean;
}): string[] {
  const company = String(opts.company || "").trim();
  const widgetKey = String(opts.widget_key || "").trim();
  if (!company || !widgetKey) return [];
  return [
    widgetStorageKey(
      opts.userKey,
      widgetKey,
      company,
      opts.from_date || "",
      opts.period || "ytd",
      opts.territory,
      opts.show_ly !== false
    ),
  ];
}

function candidateKeys(opts: {
  userKey: string;
  dashboardId: string;
  company?: string;
  from_date?: string;
  period?: string;
  territory?: string;
}): string[] {
  const company = String(opts.company || "").trim();
  if (!company) return [];
  return [
    boardStorageKey(
      opts.userKey,
      opts.dashboardId || "home",
      company,
      opts.from_date || "",
      opts.period || "ytd",
      opts.territory
    ),
  ];
}

/** True when batch has widget keys (paint stale cache even if values are zero). */
export function boardPayloadHasWidgets(
  data: DashboardBoardDataResponse | null | undefined
): boolean {
  return Boolean(
    data?.widgets &&
      typeof data.widgets === "object" &&
      Object.keys(data.widgets).length > 0
  );
}

/** Reject empty / all-zero board payloads so we never cache a bad fetch. */
export function boardPayloadLooksUseful(
  data: DashboardBoardDataResponse | null | undefined
): boolean {
  if (!data?.widgets || typeof data.widgets !== "object") return false;
  const entries = Object.values(data.widgets);
  if (!entries.length) return false;
  for (const w of entries) {
    if (!w) continue;
    if (Array.isArray(w.kpis) && w.kpis.some((k) => Number(k?.value) !== 0)) {
      return true;
    }
    if (Array.isArray(w.rows) && w.rows.some((r) => Number(r?.value) !== 0)) {
      return true;
    }
    if (
      Array.isArray(w.chart?.series) &&
      w.chart!.series.some((p) => Number(p?.value) !== 0)
    ) {
      return true;
    }
    if (
      Array.isArray(w.table?.rows) &&
      w.table!.rows.some((r) => Number((r as any)?.value) !== 0)
    ) {
      return true;
    }
    if (w.action && typeof w.action === "object") return true;
  }
  return false;
}

/** Single widget has renderable structure (paint stale cache). */
export function widgetPayloadHasContent(
  data: DashboardWidgetDataResponse | null | undefined
): boolean {
  if (!data?.widget_key) return false;
  if (data.meta?.source === "empty") return false;
  return Boolean(
    data.kpis?.length ||
      data.rows?.length ||
      data.chart?.series?.length ||
      data.table?.rows?.length ||
      data.chart?.summary ||
      data.action
  );
}

/** Skip caching empty / all-zero widget payloads. */
export function widgetPayloadLooksUseful(
  data: DashboardWidgetDataResponse | null | undefined
): boolean {
  if (!widgetPayloadHasContent(data)) return false;
  if (Array.isArray(data?.kpis) && data!.kpis.some((k) => Number(k?.value) !== 0)) {
    return true;
  }
  if (Array.isArray(data?.rows) && data!.rows.some((r) => Number(r?.value) !== 0)) {
    return true;
  }
  if (
    Array.isArray(data?.chart?.series) &&
    data!.chart!.series.some((p) => Number(p?.value) !== 0)
  ) {
    return true;
  }
  if (
    Array.isArray(data?.table?.rows) &&
    data!.table!.rows.some((r) => Number((r as { value?: number })?.value) !== 0)
  ) {
    return true;
  }
  if (data?.chart?.summary && Number(data.chart.summary.value) !== 0) {
    return true;
  }
  if (data?.action && typeof data.action === "object") return true;
  return false;
}

async function readWidgetByKey(
  storageKey: string,
  userKey: string
): Promise<{ data: DashboardWidgetDataResponse; savedAt: number } | null> {
  const mem = widgetMemory.get(storageKey);
  if (mem && Date.now() - mem.savedAt <= WIDGET_MAX_AGE_MS) {
    const data = mem.data as unknown as DashboardWidgetDataResponse;
    if (!widgetPayloadHasContent(data)) return null;
    return { data, savedAt: mem.savedAt };
  }
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<DashboardWidgetDataResponse>;
    if (
      !env ||
      env.version !== VERSION ||
      env.userKey !== userKey ||
      !env.payload?.widget_key
    ) {
      return null;
    }
    if (Date.now() - env.savedAt > WIDGET_MAX_AGE_MS) {
      return null;
    }
    if (!widgetPayloadHasContent(env.payload)) return null;
    widgetMemory.set(storageKey, {
      savedAt: env.savedAt,
      data: env.payload as unknown as DashboardBoardDataResponse,
    });
    return { data: env.payload, savedAt: env.savedAt };
  } catch {
    return null;
  }
}

export async function readCachedWidget(opts: {
  userKey: string;
  widget_key: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  show_ly?: boolean;
}): Promise<{ data: DashboardWidgetDataResponse; savedAt: number } | null> {
  if (!String(opts.company || "").trim()) return null;
  for (const key of widgetCandidateKeys(opts)) {
    const hit = await readWidgetByKey(key, opts.userKey);
    if (hit) return hit;
  }
  return null;
}

export async function writeCachedWidget(opts: {
  userKey: string;
  widget_key: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  show_ly?: boolean;
  data: DashboardWidgetDataResponse;
}): Promise<void> {
  if (!String(opts.company || "").trim()) return;
  if (!widgetPayloadLooksUseful(opts.data)) {
    logger.debug("Skip widget cache write — payload empty/zeros", {
      widget_key: opts.widget_key,
    });
    return;
  }
  const keys = widgetCandidateKeys(opts);
  if (!keys.length) return;
  const savedAt = Date.now();
  const env: Envelope<DashboardWidgetDataResponse> = {
    version: VERSION,
    userKey: opts.userKey,
    savedAt,
    payload: opts.data,
  };
  const raw = JSON.stringify(env);
  for (const storageKey of keys) {
    widgetMemory.set(storageKey, {
      savedAt,
      data: opts.data as unknown as DashboardBoardDataResponse,
    });
    try {
      await AsyncStorage.setItem(storageKey, raw);
    } catch (e) {
      logger.warn("Failed to write widget cache", e);
    }
  }
}

export function peekCachedWidgetSync(opts: {
  userKey: string;
  widget_key: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  show_ly?: boolean;
}): { data: DashboardWidgetDataResponse; savedAt: number } | null {
  if (!String(opts.company || "").trim()) return null;
  for (const storageKey of widgetCandidateKeys(opts)) {
    const mem = widgetMemory.get(storageKey);
    if (mem && Date.now() - mem.savedAt <= WIDGET_MAX_AGE_MS) {
      const data = mem.data as unknown as DashboardWidgetDataResponse;
      if (!widgetPayloadHasContent(data)) return null;
      return { data, savedAt: mem.savedAt };
    }
  }
  return null;
}

export async function hydrateCachedWidgets(
  userKey: string,
  widgetKeys: string[],
  scope: {
    company?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    territory?: string;
    show_ly?: boolean;
  }
): Promise<void> {
  if (!widgetKeys.length || !String(scope.company || "").trim()) return;
  await Promise.all(
    widgetKeys.map((widget_key) =>
      readCachedWidget({ userKey, widget_key, ...scope })
    )
  );
}

export async function readCachedBootstrap(
  userKey: string
): Promise<{ bootstrap: MobileBootstrap; savedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(bootstrapKey(userKey));
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<MobileBootstrap>;
    if (
      !env ||
      env.version !== VERSION ||
      env.userKey !== userKey ||
      !env.payload?.modules
    ) {
      return null;
    }
    if (Date.now() - env.savedAt > BOOTSTRAP_MAX_AGE_MS) {
      return null;
    }
    return { bootstrap: env.payload, savedAt: env.savedAt };
  } catch (e) {
    logger.warn("Failed to read bootstrap cache", e);
    return null;
  }
}

export async function writeCachedBootstrap(
  userKey: string,
  bootstrap: MobileBootstrap
): Promise<void> {
  try {
    const env: Envelope<MobileBootstrap> = {
      version: VERSION,
      userKey,
      savedAt: Date.now(),
      payload: bootstrap,
    };
    await AsyncStorage.setItem(bootstrapKey(userKey), JSON.stringify(env));
  } catch (e) {
    logger.warn("Failed to write bootstrap cache", e);
  }
}

async function readBoardByKey(
  storageKey: string,
  userKey: string
): Promise<{ data: DashboardBoardDataResponse; savedAt: number } | null> {
  const mem = boardMemory.get(storageKey);
  if (mem && Date.now() - mem.savedAt <= BOARD_MAX_AGE_MS) {
    if (!boardPayloadHasWidgets(mem.data)) return null;
    return { data: mem.data, savedAt: mem.savedAt };
  }
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<DashboardBoardDataResponse>;
    if (
      !env ||
      env.version !== VERSION ||
      env.userKey !== userKey ||
      !env.payload?.widgets
    ) {
      return null;
    }
    if (Date.now() - env.savedAt > BOARD_MAX_AGE_MS) {
      return null;
    }
    if (!boardPayloadHasWidgets(env.payload)) return null;
    boardMemory.set(storageKey, { savedAt: env.savedAt, data: env.payload });
    return { data: env.payload, savedAt: env.savedAt };
  } catch {
    return null;
  }
}

export async function readCachedBoard(opts: {
  userKey: string;
  dashboardId: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
}): Promise<{ data: DashboardBoardDataResponse; savedAt: number } | null> {
  if (!String(opts.company || "").trim()) return null;
  for (const key of candidateKeys(opts)) {
    const hit = await readBoardByKey(key, opts.userKey);
    if (hit) return hit;
  }
  return null;
}

export async function writeCachedBoard(opts: {
  userKey: string;
  dashboardId: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
  queryKey?: readonly unknown[];
  data: DashboardBoardDataResponse;
}): Promise<void> {
  if (!String(opts.company || "").trim()) return;
  if (!boardPayloadLooksUseful(opts.data)) {
    logger.info("Skip board cache write — payload empty/zeros", {
      dashboardId: opts.dashboardId,
    });
    return;
  }
  const keys = candidateKeys(opts);
  if (!keys.length) return;
  const savedAt = Date.now();
  const env: Envelope<DashboardBoardDataResponse> = {
    version: VERSION,
    userKey: opts.userKey,
    savedAt,
    payload: opts.data,
  };
  const raw = JSON.stringify(env);
  for (const storageKey of keys) {
    boardMemory.set(storageKey, { savedAt, data: opts.data });
    try {
      await AsyncStorage.setItem(storageKey, raw);
    } catch (e) {
      logger.warn("Failed to write board cache", e);
    }
  }
}

/** Sync peek for React Query initialData (memory only — hydrate first). */
export function peekCachedBoardSync(opts: {
  userKey: string;
  dashboardId: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  period?: string;
  territory?: string;
}): { data: DashboardBoardDataResponse; savedAt: number } | null {
  if (!String(opts.company || "").trim()) return null;
  for (const storageKey of candidateKeys(opts)) {
    const mem = boardMemory.get(storageKey);
    if (mem && Date.now() - mem.savedAt <= BOARD_MAX_AGE_MS) {
      if (!boardPayloadHasWidgets(mem.data)) return null;
      return { data: mem.data, savedAt: mem.savedAt };
    }
  }
  return null;
}

/** Prefetch home (and optional) boards into memory before Home mounts. */
export async function hydrateBoardMemory(
  userKey: string,
  boards: Array<{
    dashboardId: string;
    company?: string;
    from_date?: string;
    to_date?: string;
    period?: string;
    territory?: string;
  }>
): Promise<void> {
  await Promise.all(
    boards.map(async (b) => {
      await readCachedBoard({
        userKey,
        dashboardId: b.dashboardId,
        company: b.company,
        from_date: b.from_date,
        to_date: b.to_date,
        period: b.period,
        territory: b.territory,
      });
    })
  );
}

/** Load all dashboard board caches from disk into memory (instant paint). */
export async function hydrateAllDashboardBoards(
  userKey: string,
  company: string,
  period: Pick<DateRange, "from_date" | "to_date" | "preset">,
  territory?: string
): Promise<void> {
  const territoryPart = String(territory || "").trim();
  await hydrateBoardMemory(
    userKey,
    DASHBOARD_BOARD_IDS.map((dashboardId) => ({
      dashboardId,
      company,
      from_date: period.from_date,
      to_date: period.to_date,
      period: period.preset,
      territory: territoryPart || undefined,
    }))
  );
}

export async function clearSessionCache(userKey?: string | null): Promise<void> {
  boardMemory.clear();
  widgetMemory.clear();
  activeUserKey = null;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => {
      const isOurs =
        k.startsWith("@printechs/cache/bootstrap/") ||
        k.startsWith("@printechs/cache/board/") ||
        k.startsWith("@printechs/cache/widget/");
      if (!isOurs) return false;
      if (!userKey) return true;
      return k.includes(userKey);
    });
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (e) {
    logger.warn("Failed to clear session cache", e);
  }
}
