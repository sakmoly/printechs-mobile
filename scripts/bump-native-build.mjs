/**
 * Increments expo.ios.buildNumber and expo.android.versionCode in app.json.
 * Run before EAS submit when Apple/Google reject "already submitted this build".
 *
 * Usage: node scripts/bump-native-build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJsonPath = join(__dirname, "..", "app.json");

const raw = readFileSync(appJsonPath, "utf8");
const app = JSON.parse(raw);
const expo = app.expo;

if (!expo?.ios) expo.ios = {};
if (!expo?.android) expo.android = {};

const iosPrev = String(expo.ios.buildNumber ?? "0");
const iosNext = String(parseInt(iosPrev, 10) + 1 || 1);
expo.ios.buildNumber = iosNext;

const androidPrev = Number(expo.android.versionCode ?? 0);
const androidNext = androidPrev + 1 || 1;
expo.android.versionCode = androidNext;

writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + "\n", "utf8");

console.log(
  `Bumped iOS buildNumber: ${iosPrev} → ${iosNext}, Android versionCode: ${androidPrev} → ${androidNext}`
);
