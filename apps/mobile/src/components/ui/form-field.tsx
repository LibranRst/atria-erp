import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { useFormPresentation } from "./form-presentation-context";
import { theme } from "@/theme";

export type FormFieldProps = {
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly helper?: string;
  readonly label: string;
  readonly optional?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function FormField({
  children,
  error,
  helper,
  label,
  optional,
  readOnly,
  required,
  style,
}: FormFieldProps): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  const suffix = readOnly ? "Hanya baca" : required ? "Wajib" : optional ? "Opsional" : undefined;

  return (
    <View style={[grouped ? styles.grouped : styles.standalone, style]}>
      <View style={grouped ? styles.groupedLabelBlock : styles.labelRow}>
        <Text style={grouped ? styles.groupedLabel : styles.label}>{label}</Text>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      <View style={grouped ? styles.groupedControl : undefined}>{children}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  standalone: { gap: theme.spacing.xs },
  grouped: {
    minHeight: 64,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs },
  groupedLabelBlock: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.base },
  label: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  groupedLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
  suffix: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
  },
  groupedControl: { minWidth: 0 },
  helper: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  error: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
});
