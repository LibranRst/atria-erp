import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "./app-icon";
import { FormField } from "./form-field";
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

  return (
    <FormField
      error={error}
      helper={helper}
      label={label}
      optional={optional}
      readOnly={readOnly}
      required={required}
    >
      <Pressable
        accessibilityHint="Membuka lembar pilihan"
        accessibilityLabel={`${label}, ${selected?.label ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        hitSlop={grouped ? 8 : 4}
        onPress={onPress}
        style={({ pressed }) => [
          styles.control,
          grouped ? styles.grouped : styles.standalone,
          pressed && styles.pressed,
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
      </Pressable>
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled: option.disabled }}
      disabled={option.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active && styles.activeOption,
        pressed && styles.pressed,
        option.disabled && styles.disabled,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.optionLabel, active && styles.activeText]}>{option.label}</Text>
        {option.description || option.meta || option.disabledReason ? (
          <Text style={styles.meta}>
            {option.disabledReason ?? option.description ?? option.meta}
          </Text>
        ) : null}
      </View>
      {active ? <AppIcon color={theme.colors.accent} name="check" size={16} weight="bold" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  standalone: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.ringControl,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLowest,
    paddingHorizontal: 20,
    boxShadow: theme.shadows.control,
  },
  grouped: { minHeight: 32, backgroundColor: "transparent" },
  copy: { flex: 1, minWidth: 0 },
  value: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
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
  activeOption: { backgroundColor: theme.colors.accentContainer },
  optionLabel: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  activeText: { color: theme.colors.accent },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
});
