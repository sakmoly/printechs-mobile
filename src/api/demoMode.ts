/**
 * Demo / App Store review mode: no ERP server URL configured.
 * Saving a real server URL in settings turns demo off.
 *
 * Uses require() inside the function to avoid a static import cycle
 * (auth → oauth → demoMode → auth).
 */
export function isDemoMode(): boolean {
  try {
    const { useAuthStore } = require("../store/auth");
    const url = useAuthStore.getState().serverConfig?.serverUrl?.trim() ?? "";
    return url.length === 0;
  } catch {
    return true;
  }
}
