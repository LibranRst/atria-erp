import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "./app-icon";
import { SheetOptionRow, type SelectOption } from "./sheet-select";
import { theme } from "@/theme";

export function MoneyInput({
  accessibilityLabel,
  onChange,
  value,
}: {
  readonly accessibilityLabel: string;
  readonly onChange: (value: number | "") => void;
  readonly value: number | "";
}): React.JSX.Element {
  return (
    <View style={styles.moneyInput}>
      <Text style={styles.prefix}>Rp</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="number-pad"
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "");
          onChange(digits ? Number(digits) : "");
        }}
        placeholder="0"
        placeholderTextColor={theme.colors.outline}
        selectionColor={theme.colors.accent}
        style={styles.moneyText}
        value={value === "" ? "" : new Intl.NumberFormat("id-ID").format(value)}
      />
    </View>
  );
}

export function QuantityStepper({
  onChange,
  value,
}: {
  readonly onChange: (value: number) => void;
  readonly value: number;
}): React.JSX.Element {
  return (
    <View accessibilityLabel={`Kuantitas ${value}`} style={styles.stepper}>
      <Pressable
        accessibilityLabel="Kurangi kuantitas"
        accessibilityRole="button"
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.stepButton}
      >
        <AppIcon color={theme.colors.onSurface} name="remove" size={16} weight="bold" />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        accessibilityLabel="Tambah kuantitas"
        accessibilityRole="button"
        onPress={() => onChange(value + 1)}
        style={styles.stepButton}
      >
        <AppIcon color={theme.colors.onSurface} name="add" size={16} weight="bold" />
      </Pressable>
    </View>
  );
}

export function SelectionSheet({
  onClose,
  onSelect,
  options,
  title,
  value,
  visible,
}: {
  readonly onClose: () => void;
  readonly onSelect: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly title: string;
  readonly value: string;
  readonly visible: boolean;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="formSheet"
      visible={visible}
    >
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
        <View style={styles.pullBar} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable
            accessibilityLabel="Tutup pilihan"
            onPress={onClose}
            style={styles.closeButton}
          >
            <AppIcon color={theme.colors.onSurface} name="close" size={18} weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.options}>
          <View style={styles.optionSurface}>
            {options.map((option, index) => (
              <View key={option.value} style={index > 0 ? styles.optionDivider : undefined}>
                <SheetOptionRow
                  active={option.value === value}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  option={option}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  moneyInput: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  prefix: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  moneyText: {
    flex: 1,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    fontVariant: ["tabular-nums"],
    paddingVertical: 0,
    ...theme.typography.row,
  },
  stepper: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  stepButton: { width: 48, minHeight: 40, alignItems: "center", justifyContent: "center" },
  stepValue: {
    minWidth: 28,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...theme.typography.row,
  },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.surfaceContainerLow,
    paddingTop: theme.spacing.sm,
  },
  pullBar: {
    width: 36,
    height: 5,
    alignSelf: "center",
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceContainerHighest,
  },
  sheetHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.marginMobile,
  },
  sheetTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  options: { padding: theme.spacing.md },
  optionSurface: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outlineVariant,
  },
});
