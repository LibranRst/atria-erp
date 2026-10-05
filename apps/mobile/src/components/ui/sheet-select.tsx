import { Platform, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "./app-icon";
import { FormField } from "./form-field";
import { RowAction } from "./row-action";
import { useFormPresentation } from "./form-presentation-context";
import { theme } from "@/theme";

export type SelectOption = {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly group?: string;
  readonly label: string;
  readonly meta?: string;
  readonly value: string;
};

export function SheetSelect({
  disabled,
  error,
  fieldId,
  helper,
  label,
  onPress,
  optional,
  options,
  placeholder = "Pilih opsi",
  readOnly,
  required,
  value,
}: {
  readonly disabled?: boolean;
  readonly error?: string;
  readonly fieldId?: string;
  readonly helper?: string;
  readonly label: string;
  readonly onPress: () => void;
  readonly optional?: boolean;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly value: string;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || readOnly;

  if (grouped)
    return (
      <RowAction
        accessibilityLabel={`${label}, ${selected?.label ?? placeholder}`}
        accessibilityHint="Membuka pilihan"
        disabled={unavailable}
        onPress={onPress}
        style={[styles.grouped, unavailable && styles.disabled]}
      >
        <FormField
          fieldId={fieldId}
          error={error}
          helper={helper}
          label={label}
          optional={optional}
          readOnly={readOnly}
          required={required}
        >
          <View style={styles.control}>
            <View style={styles.copy}>
              <Text
                numberOfLines={1}
                style={[styles.value, styles.groupedValue, !selected && styles.placeholder]}
              >
                {selected?.label ?? placeholder}
              </Text>
              {selected?.description || selected?.meta ? (
                <Text numberOfLines={1} style={styles.meta}>
                  {selected.description ?? selected.meta}
                </Text>
              ) : null}
            </View>
            <AppIcon color={theme.colors.onSurfaceVariant} name="expand_more" size={16} />
          </View>
        </FormField>
      </RowAction>
    );

  return (
    <FormField
      fieldId={fieldId}
      error={error}
      helper={helper}
      label={label}
      optional={optional}
      readOnly={readOnly}
      required={required}
    >
      <RowAction
        accessibilityHint="Membuka pilihan"
        accessibilityLabel={`${label}, ${selected?.label ?? placeholder}`}
        disabled={unavailable}
        onPress={onPress}
        style={[
          styles.control,
          grouped ? styles.grouped : styles.standalone,
          unavailable && styles.disabled,
        ]}
      >
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.value, !selected && styles.placeholder]}>
            {selected?.label ?? placeholder}
          </Text>
          {selected?.description || selected?.meta ? (
            <Text numberOfLines={1} style={styles.meta}>
              {selected.description ?? selected.meta}
            </Text>
          ) : null}
        </View>
        <AppIcon color={theme.colors.onSurfaceVariant} name="expand_more" size={16} />
      </RowAction>
    </FormField>
  );
}

export function SheetOptionRow({
  active,
  onPress,
  option,
}: {
  readonly active: boolean;
  readonly onPress: () => void;
  readonly option: SelectOption;
}): React.JSX.Element {
  return (
    <RowAction
      accessibilityLabel={option.label}
      accessibilityHint={option.disabledReason ?? option.description ?? option.meta}
      selected={active}
      testID={`selection-option-${option.value}`}
      disabled={option.disabled}
      onPress={onPress}
      style={[styles.option, active && styles.activeOption]}
    >
      <View style={styles.copy}>
        <Text style={[styles.optionLabel, active && styles.activeText]}>{option.label}</Text>
        {option.disabledReason || option.description ? (
          <Text style={styles.optionMeta}>{option.disabledReason ?? option.description}</Text>
        ) : null}
        {option.meta && option.meta !== (option.disabledReason ?? option.description) ? (
          <Text style={styles.optionMeta}>{option.meta}</Text>
        ) : null}
      </View>
      <View style={styles.optionIndicator}>
        {active ? (
          <AppIcon color={theme.colors.accent} name="check" size={18} weight="bold" />
        ) : null}
      </View>
    </RowAction>
  );
}

const styles = StyleSheet.create({
  control: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  standalone: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.ringControl,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLowest,
    paddingHorizontal: 20,
    boxShadow: theme.shadows.control,
  },
  grouped: { backgroundColor: "transparent" },
  copy: { flex: 1, minWidth: 0 },
  value: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  groupedValue: {
    fontFamily: theme.fonts.semibold,
    ...theme.typography.section,
  },
  placeholder: { color: theme.colors.outline },
  meta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
    ...theme.typography.meta,
  },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  activeOption: { backgroundColor: "transparent" },
  optionLabel: {
    color: theme.colors.onSurface,
    fontFamily: Platform.OS === "ios" ? undefined : theme.fonts.medium,
    ...theme.typography.section,
  },
  optionMeta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: Platform.OS === "ios" ? undefined : theme.fonts.regular,
    marginTop: theme.spacing.base,
    ...theme.typography.row,
  },
  optionIndicator: { width: 20, alignItems: "center" },
  activeText: { color: theme.colors.accent },
  disabled: { opacity: 0.5 },
});
