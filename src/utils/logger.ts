/**
 * Dev-safe logger — never prints tokens, passwords, or Authorization values.
 * In production (__DEV__ false), only warn/error are emitted (message only).
 */

const SENSITIVE_KEY =
  /^(authorization|password|access_token|refresh_token|token|secret|api_key|client_secret)$/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string" && value.length > 20) {
    if (/^Bearer\s+/i.test(value)) return "Bearer [redacted]";
    if (/eyJ[A-Za-z0-9_-]+\./.test(value)) return "[redacted-jwt]";
  }
  return value;
}

function sanitize(arg: unknown): unknown {
  if (arg == null) return arg;
  if (typeof arg !== "object") return arg;
  if (Array.isArray(arg)) return arg.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(arg as Record<string, unknown>)) {
    out[k] = redactValue(k, sanitize(v));
  }
  return out;
}

function prepare(args: unknown[]): unknown[] {
  return args.map((a) =>
    typeof a === "object" && a !== null ? sanitize(a) : a
  );
}

/** Set EXPO_PUBLIC_VERBOSE_LOGS=1 to restore debug/info/warn in development. */
const VERBOSE_LOGS =
  __DEV__ && process.env.EXPO_PUBLIC_VERBOSE_LOGS === "1";

export const logger = {
  debug(...args: unknown[]) {
    if (VERBOSE_LOGS) console.log(...prepare(args));
  },
  info(...args: unknown[]) {
    if (VERBOSE_LOGS) console.log(...prepare(args));
  },
  warn(...args: unknown[]) {
    if (VERBOSE_LOGS) console.warn(...prepare(args));
  },
  error(...args: unknown[]) {
    console.error(...prepare(args));
  },
};
