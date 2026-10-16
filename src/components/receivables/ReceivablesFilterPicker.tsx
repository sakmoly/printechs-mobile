import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { systemHomeClearance } from "../SafeScreen";
import { RECEIVABLES } from "../../screens/receivables/receivablesTheme";
import { Fonts } from "../../theme/typography";

export type FilterPickerOption = {
  id: string;
  label: string;
  subtitle?: string;
};

type Props = {
  visible: boolean;
  title: string;
  options: FilterPickerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function ReceivablesFilterPicker({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const sheetBottomPad = systemHomeClearance(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTap}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filter picker"
        />
        <View style={[styles.sheet, { paddingBottom: sheetBottomPad }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={RECEIVABLES.subtitle} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {options.length === 0 ? (
              <Text style={styles.empty}>No options available</Text>
            ) : (
              options.map((opt) => {
                const active = opt.id === selectedId;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.row, active && styles.rowActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      onSelect(opt.id);
                      onClose();
                    }}
                  >
                    <View style={styles.rowText}>
                      <Text
                        style={[
                          styles.rowLabel,
                          active && styles.rowLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text style={styles.rowSub} numberOfLines={2}>
                          {opt.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={RECEIVABLES.link}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: RECEIVABLES.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
  },
  listContent: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RECEIVABLES.border,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    color: RECEIVABLES.title,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  rowActive: {
    backgroundColor: "#eff6ff",
  },
  rowText: {
    flex: 1,
    paddingRight: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.bodySemi,
    color: RECEIVABLES.value,
  },
  rowLabelActive: {
    color: RECEIVABLES.link,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: RECEIVABLES.subtitle,
    marginTop: 2,
  },
});
