import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./app-icon";
import { RowAction } from "./row-action";
import type { SelectOption } from "./sheet-select";
import { theme } from "@/theme";

export type OptionChoiceGroupProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
};

export function OptionChoiceGroup({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: OptionChoiceGroupProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          const unavailable = disabled || option.disabled;
          return (
            <RowAction
              key={option.value}
              accessibilityLabel={option.label}
              accessibilityHint={option.disabledReason ?? option.description ?? option.meta}
              disabled={unavailable}
              selected={selected}
              onPress={() => onChange(option.value)}
              style={styles.option}
            >
              <View style={styles.copy}>
                <Text style={[styles.optionLabel, selected && styles.selected]}>
                  {option.label}
                </Text>
                {option.disabledReason || option.description || option.meta ? (
                  <Text style={styles.description}>
                    {option.disabledReason ?? option.description ?? option.meta}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <AppIcon name="check_circle" size={20} color={theme.colors.accent} weight="fill" />
              ) : (
                <View style={styles.unchecked} />
              )}
            </RowAction>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0, gap: theme.spacing.base, padding: theme.spacing.sm },
  label: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  options: { minWidth: 0, gap: theme.spacing.base },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
    minHeight: 52,
  },
  copy: { minWidth: 0, flex: 1, gap: theme.spacing.base },
  optionLabel: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  selected: { color: theme.colors.accent },
  unchecked: {
    width: 20,
    height: 20,
    borderRadius: theme.radii.capsule,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.ringControl,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
});
