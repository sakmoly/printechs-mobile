import { Alert, Linking, Platform } from "react-native";
import * as Contacts from "expo-contacts";

/** Digits only, no leading + — for wa.me links. */
export function normalizePhoneForWhatsApp(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

export async function openWhatsAppChat(
  message: string,
  phone?: string | null
): Promise<void> {
  const text = encodeURIComponent(message);
  const normalized = phone ? normalizePhoneForWhatsApp(phone) : null;
  const urls = normalized
    ? [`https://wa.me/${normalized}?text=${text}`, `whatsapp://send?phone=${normalized}&text=${text}`]
    : [`whatsapp://send?text=${text}`, `https://wa.me/?text=${text}`];

  let lastErr: unknown;
  for (const url of urls) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        normalized
          ? "WhatsApp is not installed or could not open this number."
          : "WhatsApp is not installed on this device."
      );
}

export async function pickPhoneFromContacts(): Promise<string | null> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Contacts access",
      "Allow contacts access in Settings to pick a WhatsApp recipient from your phone book."
    );
    return null;
  }

  const contact = await Contacts.presentContactPickerAsync();
  if (!contact?.phoneNumbers?.length) return null;

  const numbers = contact.phoneNumbers
    .map((p) => ({
      label: String(p.label || ""),
      normalized: normalizePhoneForWhatsApp(String(p.number || "")),
    }))
    .filter((p) => p.normalized);

  if (!numbers.length) {
    Alert.alert("WhatsApp", "That contact has no usable phone number.");
    return null;
  }

  if (numbers.length === 1) return numbers[0].normalized;

  return new Promise((resolve) => {
    Alert.alert(
      "Phone number",
      contact.name ? `Send to ${contact.name}` : "Choose a number",
      [
        ...numbers.slice(0, 3).map((n) => ({
          text: n.label ? `${n.label}: ${n.normalized}` : n.normalized!,
          onPress: () => resolve(n.normalized),
        })),
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]
    );
  });
}

function maskPhone(digits: string): string {
  if (digits.length <= 4) return digits;
  return `…${digits.slice(-4)}`;
}

export type WhatsAppShareOptions = {
  message: string;
  /** ERP / customer record mobile, if any */
  customerPhone?: string | null;
  customerName?: string;
};

/**
 * Payment Overdue, Customer 360, etc. — contact list first, optional ERP mobile, or pick in WhatsApp.
 */
export function presentWhatsAppShare(options: WhatsAppShareOptions): void {
  const { message, customerPhone, customerName } = options;
  const erpNormalized = customerPhone
    ? normalizePhoneForWhatsApp(customerPhone)
    : null;

  const sendToPhone = async (phone: string | null | undefined) => {
    try {
      await openWhatsAppChat(message, phone);
    } catch (e) {
      Alert.alert(
        "WhatsApp",
        e instanceof Error ? e.message : "Failed to open WhatsApp"
      );
    }
  };

  const buttons: {
    text: string;
    onPress?: () => void;
    style?: "cancel" | "default" | "destructive";
  }[] = [
    {
      text: "Choose from contacts",
      onPress: () => {
        void (async () => {
          const picked = await pickPhoneFromContacts();
          if (picked) await sendToPhone(picked);
        })();
      },
    },
  ];

  if (erpNormalized) {
    buttons.push({
      text: customerName
        ? `Customer mobile (${maskPhone(erpNormalized)})`
        : `Number on file (${maskPhone(erpNormalized)})`,
      onPress: () => {
        void sendToPhone(erpNormalized);
      },
    });
  }

  buttons.push({
    text: Platform.OS === "ios" ? "Choose in WhatsApp" : "Choose recipient in WhatsApp",
    onPress: () => {
      void sendToPhone(undefined);
    },
  });

  buttons.push({ text: "Cancel", style: "cancel" });

  Alert.alert("Send via WhatsApp", "How do you want to send this message?", buttons);
}
