/**
 * Normalize and heal ERPNext base URLs used by the mobile HTTP client.
 *
 * Some hostnames resolve but fail TLS on devices (Axios → "Network Error").
 * Keep a small alias map for known live sites so Save / runtime stay on a
 * working origin without asking users to guess www vs erp.
 */

/** Hosts that are known-broken or alias to the real ERP site */
const HOST_ALIASES: Record<string, string> = {
  // Apex host often fails TLS / doesn't serve ERPNext — use www
  "printechs.com": "https://www.printechs.com",
  // erp.printechs.com has an untrusted/broken TLS cert → Network Error on device
  "erp.printechs.com": "https://www.printechs.com",
  "www.erp.printechs.com": "https://www.printechs.com",
  // support.printechs.com is not an ERPNext site (TLS name mismatch +
  // nginx "support.printechs.com does not exist") — use live ERP host
  "support.printechs.com": "https://www.printechs.com",
  "www.support.printechs.com": "https://www.printechs.com",
};

export type NormalizedServerUrl = {
  /** Final URL to store and use for API calls (no trailing slash) */
  url: string;
  /** True when we remapped away from the typed host */
  remapped: boolean;
  /** Original trimmed input (before alias) */
  original: string;
  /** Human-readable note when remapped */
  note?: string;
};

/**
 * Trim, strip trailing slash, and apply known host aliases.
 * Returns empty string when input is blank.
 */
export function normalizeServerUrl(input: string | null | undefined): NormalizedServerUrl {
  const original = (input || "").trim().replace(/\/$/, "");
  if (!original) {
    return { url: "", remapped: false, original: "" };
  }

  let candidate = original;
  if (
    !candidate.startsWith("http://") &&
    !candidate.startsWith("https://")
  ) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const alias = HOST_ALIASES[host];
    if (alias) {
      return {
        url: alias.replace(/\/$/, ""),
        remapped: true,
        original,
        note: `${host} is not reachable over HTTPS from the app. Using ${alias} instead.`,
      };
    }
    // Drop default ports / trailing slash consistently
    const port =
      parsed.port &&
      !(
        (parsed.protocol === "https:" && parsed.port === "443") ||
        (parsed.protocol === "http:" && parsed.port === "80")
      )
        ? `:${parsed.port}`
        : "";
    return {
      url: `${parsed.protocol}//${parsed.hostname}${port}`.replace(/\/$/, ""),
      remapped: false,
      original,
    };
  } catch {
    return { url: candidate.replace(/\/$/, ""), remapped: false, original };
  }
}

/** Convenience: just the URL string (empty if none). */
export function resolveServerBaseUrl(
  input: string | null | undefined
): string {
  return normalizeServerUrl(input).url;
}

export function isNetworkOrTlsError(error: unknown): boolean {
  const err = error as {
    message?: string;
    code?: string;
    response?: unknown;
  };
  if (err?.response) return false;
  const msg = (err?.message || "").toLowerCase();
  const code = (err?.code || "").toUpperCase();
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ERR_NETWORK" ||
    msg.includes("network error") ||
    msg.includes("network request failed") ||
    msg.includes("ssl") ||
    msg.includes("certificate") ||
    msg.includes("trust") ||
    msg.includes("unable to connect")
  );
}
