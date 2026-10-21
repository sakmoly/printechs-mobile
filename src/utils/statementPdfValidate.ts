import {
  getInfoAsync,
  readAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";

/** Printechs SOA table / line markers (desk PDF usually embeds these as text). */
const SOA_BODY_MARKERS = [
  "due date",
  "posting date",
  "invoice no",
  "invoice",
  "outstanding",
  "bill to",
  "voucher no",
  "as on",
] as const;

function decodeBase64Sample(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  if (!clean) return "";
  const atobFn = globalThis.atob;
  if (typeof atobFn !== "function") return "";
  try {
    return atobFn(clean);
  } catch {
    return "";
  }
}

/**
 * Best-effort check that a server PDF is not letterhead/footer only.
 * Compressed streams may return true (unknown) — pair with API line count when needed.
 */
/** `null` = cannot tell (compressed PDF); caller should cross-check statement API. */
export async function pdfLikelyHasStatementBody(
  uri: string
): Promise<boolean | null> {
  try {
    const info = await getInfoAsync(uri, { size: true });
    const size = info.size ?? 0;
    if (size < 800) return false;

    const maxRead = Math.min(size, 320_000);
    let b64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });
    if (b64.length > maxRead * 1.4) {
      b64 = b64.slice(0, Math.ceil(maxRead * 1.4));
    }
    const sample = decodeBase64Sample(b64);
    if (!sample) {
      return null;
    }

    const lower = sample.toLowerCase();
    let hits = 0;
    for (const m of SOA_BODY_MARKERS) {
      if (lower.includes(m)) hits += 1;
    }
    if (hits >= 2) return true;

    const templateShell =
      lower.includes("generated on") &&
      hits === 0 &&
      !/\d{1,3}(,\d{3})*\.\d{2}/.test(sample);

    if (templateShell) return false;

    return hits >= 1;
  } catch {
    return null;
  }
}
