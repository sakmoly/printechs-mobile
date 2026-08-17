/**
 * Tab bar visibility from bootstrap + Access Profile.
 * System tabs (Home, More, Settings) stay fixed; Approvals/Catalogue are gated.
 */

import { PHASE2_FEATURES } from "../api/endpoints";
import { canAccessMenuObject, type MenuPermissionState } from "../store/auth";
import { isBootstrapModuleEnabled } from "../hooks/useBootstrap";
import { resolveModuleEntry } from "./registry";

export type TabVisibility = {
  home: boolean;
  approvals: boolean;
  more: boolean;
  settings: boolean;
  catalogue: boolean;
  employees: boolean;
};

export function resolveTabVisibility(
  permissions: MenuPermissionState
): TabVisibility {
  const approvalsEntry = resolveModuleEntry("approvals");
  const catalogueEntry = resolveModuleEntry("catalogue");

  const showApprovals =
    isBootstrapModuleEnabled("approvals") &&
    canAccessMenuObject(permissions, "AO-00023") &&
    approvalsEntry?.shipped !== false;

  const showCatalogue =
    PHASE2_FEATURES.catalogue &&
    isBootstrapModuleEnabled("catalogue") &&
    canAccessMenuObject(permissions, "AO-00031") &&
    catalogueEntry?.shipped !== false;

  const showSettings = canAccessMenuObject(permissions, "AO-00025");

  const showEmployees =
    isBootstrapModuleEnabled("employees") &&
    canAccessMenuObject(permissions, "AO-00024");

  return {
    home: true,
    approvals: showApprovals,
    more: true,
    settings: showSettings,
    catalogue: showCatalogue,
    employees: showEmployees,
  };
}
