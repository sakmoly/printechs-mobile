import { isNetworkOrTlsError } from "../api/serverUrl";

/** Normalized `approve_document` / `apply` payload from erp_analysis.approvals. */
export type ApproveDocumentResult = {
  status?: string;
  docstatus?: number;
  zatca_deferred?: boolean;
  zatca_status?: string;
};

export function parseApproveDocumentResult(raw: unknown): ApproveDocumentResult {
  if (raw == null) return {};
  let bag: Record<string, unknown> =
    typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const nested = bag.message;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    bag = nested as Record<string, unknown>;
  }

  const docstatusRaw = bag.docstatus;
  const docstatus =
    typeof docstatusRaw === "number"
      ? docstatusRaw
      : docstatusRaw != null && docstatusRaw !== ""
        ? Number(docstatusRaw)
        : undefined;

  return {
    status: typeof bag.status === "string" ? bag.status : undefined,
    docstatus: Number.isFinite(docstatus) ? docstatus : undefined,
    zatca_deferred:
      bag.zatca_deferred === true ||
      bag.zatca_deferred === 1 ||
      bag.zatca_deferred === "1",
    zatca_status:
      typeof bag.zatca_status === "string" ? bag.zatca_status : undefined,
  };
}

/** User-facing success copy after approve (Sales Invoice + deferred ZATCA). */
export function approveSuccessAlertMessage(
  result: ApproveDocumentResult,
  doctype?: string
): string {
  if (result.zatca_deferred) {
    return (
      "Document approved. E-invoice (ZATCA) is being submitted in the background. " +
      "Check the invoice in ERP if status does not update within a minute or two."
    );
  }

  const dt = String(doctype || "").trim();
  if (/sales invoice/i.test(dt) && result.zatca_status) {
    return `Document approved. ZATCA status: ${result.zatca_status}.`;
  }

  return "Document approved successfully.";
}

/** User-facing message when approve/reject fails (timeouts, offline, TLS). */
export function approveActionErrorMessage(
  error: unknown,
  action: "approve" | "reject" = "approve"
): string {
  const fallback =
    action === "approve"
      ? "Failed to approve document. Please try again."
      : "Failed to reject document. Please try again.";
  const msg =
    error instanceof Error ? error.message : String(error ?? fallback);

  if (
    isNetworkOrTlsError(error) ||
    /timeout|timed out|unable to connect|network error/i.test(msg)
  ) {
    return action === "approve"
      ? "The server did not respond in time. Your approval may still be processing (invoices can take a minute for ZATCA). Pull down to refresh the list."
      : "Could not reach the server. Check your connection and try again, or refresh the list to see if the document was updated.";
  }

  return msg.trim() || fallback;
}
