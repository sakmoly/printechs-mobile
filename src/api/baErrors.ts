/**
 * Detect Frappe "method not installed" responses (usually HTTP 417).
 * Kept dependency-free so http.ts and apiResilience can share it safely.
 */

export function isMissingBaMethodError(error: unknown): boolean {
  const ax = error as {
    response?: { status?: number; data?: any };
    message?: string;
  };
  const status = ax?.response?.status;
  if (status === 404 || status === 417) return true;
  const blob = JSON.stringify(
    ax?.response?.data || ax?.message || ""
  ).toLowerCase();
  return (
    blob.includes("has no attribute") ||
    blob.includes("failed to get method") ||
    blob.includes("no module named") ||
    blob.includes("not found") ||
    blob.includes("does not exist")
  );
}

/** Detect BA SQL / schema mismatches (multi-client sites missing columns). */
export function isBaSchemaMismatchError(error: unknown): boolean {
  const ax = error as {
    response?: { status?: number; data?: any };
    message?: string;
  };
  const status = ax?.response?.status;
  if (status !== 500 && status !== 417) return false;
  const blob = JSON.stringify(
    ax?.response?.data || ax?.message || ""
  ).toLowerCase();
  return (
    blob.includes("unknown column") ||
    blob.includes("operationalerror") ||
    blob.includes("1054") ||
    blob.includes("no such column")
  );
}

/** Access Profile / role denied a BA method (HTTP 403). */
export function isBaPermissionDeniedError(error: unknown): boolean {
  const ax = error as {
    response?: { status?: number; data?: any };
    message?: string;
  };
  if (ax?.response?.status !== 403) return false;
  const data = ax.response?.data;
  const blob = JSON.stringify(data || ax?.message || "").toLowerCase();
  return (
    data?.exc_type === "PermissionError" ||
    blob.includes("permissionerror") ||
    blob.includes("access denied") ||
    blob.includes("not permitted") ||
    blob.includes("forbidden") ||
    blob.includes("not enabled for your mobile profile") ||
    // Some sites return bare 403 with little body
    true
  );
}

/** Short Frappe `_server_messages` / exception text for logs and UI. */
export function extractFrappeErrorMessage(error: unknown): string | null {
  const ax = error as { response?: { data?: any }; message?: string };
  const data = ax?.response?.data;
  const exception =
    typeof data?.exception === "string" ? data.exception : "";
  const fromExc = exception.replace(/^[\w.]+:\s*/, "").trim();
  if (fromExc) return fromExc;
  const raw = data?._server_messages;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const obj = typeof first === "string" ? JSON.parse(first) : first;
      const msg = String(obj?.message || "").trim();
      if (msg) return msg;
    } catch {
      /* ignore */
    }
  }
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  return null;
}

/** Thrown on live when a Phase 3 BA method is missing/disabled — never inject sample figures. */
export class BaApiUnavailableError extends Error {
  methodLabel: string;
  constructor(methodLabel: string) {
    super(
      `${methodLabel} is not available on this server yet. Live data only — sample figures are disabled.`
    );
    this.name = "BaApiUnavailableError";
    this.methodLabel = methodLabel;
  }
}
