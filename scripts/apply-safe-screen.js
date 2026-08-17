const fs = require("fs");
const path = require("path");

const files = [
  "app/customer-360.tsx",
  "app/sales-dashboard.tsx",
  "app/salesperson-performance.tsx",
  "app/product-performance.tsx",
  "app/collection-dashboard.tsx",
  "app/sales-order-dashboard.tsx",
  "app/receivables-dashboard.tsx",
  "app/inventory-dashboard.tsx",
  "app/inventory-health.tsx",
  "app/payables-dashboard.tsx",
  "app/purchase-performance-dashboard.tsx",
  "app/profitability-dashboard.tsx",
  "app/exceptions-dashboard.tsx",
  "app/approval-analytics.tsx",
  "app/user-profile.tsx",
  "app/employee-profile/[id].tsx",
  "app/kpi-details.tsx",
  "app/pdf-viewer.tsx",
  "app/flip-web.tsx",
];

const OPEN = "<View style={styles.container}>";
const OPEN_SAFE = "<SafeScreen style={styles.container}>";

function importPathFor(file) {
  return file.includes("employee-profile")
    ? 'import { SafeScreen } from "../../src/components/SafeScreen";'
    : 'import { SafeScreen } from "../src/components/SafeScreen";';
}

function ensureImport(src, file) {
  if (src.includes("components/SafeScreen")) return src;
  const line = importPathFor(file);
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
  }
  if (lastImport < 0) return line + "\n" + src;
  lines.splice(lastImport + 1, 0, line);
  return lines.join("\n");
}

/**
 * Replace the root <View style={styles.container}> ... matching </View>
 * that closes it (depth-based), not nested Views.
 * Skips self-closing <View ... /> tags (status dots, spacers, etc.).
 */
function isSelfClosingOpen(src, index) {
  // index at '<' of <View / <SafeScreen
  const slice = src.slice(index, index + 500);
  const m = slice.match(/^<(View|SafeScreen)\b[\s\S]*?(\/>|>)/);
  return Boolean(m && m[2] === "/>");
}

function wrapRootContainer(src) {
  const idx = src.indexOf(OPEN);
  if (idx < 0) return { src, ok: false, reason: "no-container" };
  // Allow re-entry only when this exact open still exists
  if (!src.includes(OPEN)) return { src, ok: false, reason: "already" };

  let depth = 1;
  const openRe = /<View\b|<SafeScreen\b|<\/View>|<\/SafeScreen>/g;
  openRe.lastIndex = idx + OPEN.length;
  let match;
  let closeStart = -1;
  while ((match = openRe.exec(src))) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        closeStart = match.index;
        break;
      }
    } else if (isSelfClosingOpen(src, match.index)) {
      // ignore <View ... />
      continue;
    } else {
      depth += 1;
    }
  }
  if (closeStart < 0) return { src, ok: false, reason: "no-close" };

  const closeTagLen = src.startsWith("</SafeScreen>", closeStart)
    ? "</SafeScreen>".length
    : "</View>".length;

  const next =
    src.slice(0, idx) +
    OPEN_SAFE +
    src.slice(idx + OPEN.length, closeStart) +
    "</SafeScreen>" +
    src.slice(closeStart + closeTagLen);

  return { src: next, ok: true };
}

const debugFiles = process.argv.slice(2);
const targets = debugFiles.length ? debugFiles : files;

for (const file of targets) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) {
    console.log("MISSING", file);
    continue;
  }
  let src = fs.readFileSync(full, "utf8");

  if (process.env.DEBUG_SAFE) {
    const idx = src.indexOf(OPEN);
    console.log("DEBUG", file, "idx", idx);
    let depth = 1;
    const openRe = /<View\b|<\/View>|<SafeScreen\b|<\/SafeScreen>/g;
    openRe.lastIndex = idx + OPEN.length;
    let match;
    let n = 0;
    while ((match = openRe.exec(src))) {
      n++;
      const tag = match[0];
      if (tag.startsWith("</")) depth -= 1;
      else depth += 1;
      if (n <= 8 || depth <= 1) {
        console.log(n, tag, "depth", depth, "at", match.index);
      }
      if (depth === 0) break;
      if (n > 8000) break;
    }
    console.log("final depth", depth, "matches", n);
    continue;
  }

  const result = wrapRootContainer(src);
  if (!result.ok) {
    console.log("SKIP", file, result.reason);
    continue;
  }
  src = ensureImport(result.src, file);
  let again = wrapRootContainer(src);
  let n = 1;
  while (again.ok) {
    src = again.src;
    n += 1;
    again = wrapRootContainer(src);
  }
  fs.writeFileSync(full, src);
  console.log("OK", file, "wrapped", n);
}
