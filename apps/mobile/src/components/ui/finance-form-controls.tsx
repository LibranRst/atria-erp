import { StyleSheet, Text, TextInput, View } from "react-native";

import { useFieldRegistration } from "./sheet-form-fields";
import { AppIcon } from "./app-icon";
import { RowAction } from "./row-action";
import type { SelectOption } from "./sheet-select";
import { SearchDialog, SelectionDialog } from "./selection-dialog";
import { selectDialogNeedsSearch } from "@atria/core/presentation/select-surface-policy";
import { theme } from "@/theme";

export function MoneyInput({
  accessibilityLabel,
  onChange,
  editable = true,
  value,
}: {
  readonly accessibilityLabel: string;
  readonly onChange: (value: number | "") => void;
  readonly editable?: boolean;
  readonly value: number | "";
}): React.JSX.Element {
  const { fields, id } = useFieldRegistration();
  return (
    <View style={styles.moneyInput}>
      <Text style={styles.prefix}>Rp</Text>
      <TextInput
        editable={editable}
        ref={(input) => {
          if (id) fields?.attachInput(id, input);
        }}
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
      <RowAction
        accessibilityLabel="Kurangi kuantitas"
        disabled={value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.stepButton}
      >
        <AppIcon color={theme.colors.onSurface} name="remove" size={16} weight="bold" />
      </RowAction>
      <Text style={styles.stepValue}>{value}</Text>
      <RowAction
        accessibilityLabel="Tambah kuantitas"
        onPress={() => onChange(value + 1)}
        style={styles.stepButton}
      >
        <AppIcon color={theme.colors.onSurface} name="add" size={16} weight="bold" />
      </RowAction>
    </View>
  );
}

/** Compatibility name; lightweight choices no longer present a second sheet. */
export function SelectionSheet(props: {
  readonly onClose: () => void;
  readonly onSelect: (value: string) => void;
  readonly returnFocusField?: string;
  readonly options: readonly SelectOption[];
  readonly title: string;
  readonly value: string;
  readonly visible: boolean;
}): React.JSX.Element {
  const Dialog = selectDialogNeedsSearch({ options: props.options })
    ? SearchDialog
    : SelectionDialog;
  return <Dialog {...props} />;
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
    ...theme.typography.section,
  },
  stepper: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  stepButton: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  stepValue: {
    minWidth: 28,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...theme.typography.section,
  },
});
