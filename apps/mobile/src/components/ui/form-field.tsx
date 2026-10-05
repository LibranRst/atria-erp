import { useContext, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { useFormPresentation } from "./form-presentation-context";
import { FormFieldIdContext, SheetFormFieldsContext } from "./sheet-form-fields";
import { theme } from "@/theme";

export type FormFieldProps = {
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly fieldId?: string;
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
  fieldId,
  helper,
  label,
  optional,
  readOnly,
  required,
  style,
}: FormFieldProps): React.JSX.Element {
  const fields = useContext(SheetFormFieldsContext);
  const attachView = useCallback(
    (view: View | null): void => {
      if (fieldId) fields?.attachView(fieldId, view);
    },
    [fields, fieldId],
  );
  const grouped = useFormPresentation() === "grouped";
  const suffix = readOnly ? "Hanya baca" : required ? "Wajib" : optional ? "Opsional" : undefined;

  return (
    <View
      collapsable={false}
      ref={attachView}
      style={[grouped ? styles.grouped : styles.standalone, style]}
    >
      <FormFieldIdContext.Provider value={fieldId}>
        <View style={grouped ? styles.groupedLabelBlock : styles.labelRow}>
          <Text style={grouped ? styles.groupedLabel : styles.label}>{label}</Text>
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        <View style={grouped ? styles.groupedControl : undefined}>{children}</View>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {!error && helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </FormFieldIdContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  standalone: { gap: theme.spacing.xs },
  grouped: {
    minHeight: 72,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs },
  groupedLabelBlock: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.base },
  label: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  groupedLabel: {
    flexShrink: 1,
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
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
