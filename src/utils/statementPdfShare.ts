import { Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { downloadCustomerStatementPdf } from "../api/customerStatementPdf";
import type { Customer360StatementPdfHint } from "../api/customer360Types";
import { openWhatsAppChat } from "./whatsappShare";

export type ShareStatementPdfOptions = {
  customer: string;
  resolvedCustomer?: string;
  company?: string;
  from_date?: string;
  to_date?: string;
  customerName?: string;
  statementPdfHint?: Customer360StatementPdfHint | null;
  expectOpenStatementLines?: boolean;
  bypassPdfCache?: boolean;
  /** Optional short note sent after share (opens WhatsApp with text only). */
  customerPhone?: string | null;
  includeWhatsAppTextAfterShare?: boolean;
};

/**
 * Download statement PDF from ERP, then open the OS share sheet (pick WhatsApp, Mail, etc.).
 */
export async function shareCustomerStatementPdf(
  options: ShareStatementPdfOptions
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device.");
  }

  const { uri } = await downloadCustomerStatementPdf({
    customer: options.customer,
    resolvedCustomer: options.resolvedCustomer,
    company: options.company,
    from_date: options.from_date,
    to_date: options.to_date,
    customerDisplayName: options.customerName,
    statementPdfHint: options.statementPdfHint,
    expectOpenStatementLines: options.expectOpenStatementLines,
    bypassPdfCache: options.bypassPdfCache,
  });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Send statement PDF",
  });

  if (options.includeWhatsAppTextAfterShare && options.customerPhone) {
    const name = options.customerName || "Customer";
    const note = `Dear ${name},\n\nPlease find your account statement PDF (shared above).\n\nBest regards,\nPrintechs`;
    try {
      await openWhatsAppChat(note, options.customerPhone);
    } catch {
      /* share sheet already completed */
    }
  }
}

export function presentShareStatementPdf(options: ShareStatementPdfOptions): void {
  const name = options.customerName?.trim();
  Alert.alert(
    "Share statement PDF",
    name
      ? `Download ${name}'s statement from ERP and share via WhatsApp, Mail, or other apps.`
      : "Download the statement from ERP and share via WhatsApp, Mail, or other apps.",
    [
      {
        text: "Download & share",
        onPress: () => {
          void (async () => {
            try {
              await shareCustomerStatementPdf(options);
            } catch (e) {
              Alert.alert(
                "Statement PDF",
                e instanceof Error ? e.message : "Failed to share statement PDF."
              );
            }
          })();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]
  );
}

/** Android share sheet often lists WhatsApp first when PDF is shared. */
export const statementPdfShareHint =
  Platform.OS === "ios"
    ? "Choose WhatsApp in the share sheet, then select the customer chat."
    : "Choose WhatsApp in the share sheet to send the PDF.";
