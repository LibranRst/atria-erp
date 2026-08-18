import { forwardRef } from "react";
import { StyleSheet, TextInput as NativeTextInput } from "react-native";
import type { TextInputProps as NativeTextInputProps } from "react-native";

import { useFormPresentation } from "./form-presentation-context";
import { theme } from "@/theme";

export type TextInputProps = NativeTextInputProps & {
  readonly invalid?: boolean;
};

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput(
  { editable = true, hitSlop, invalid = false, multiline = false, style, ...props },
  ref,
) {
  const grouped = useFormPresentation() === "grouped";

  return (
    <NativeTextInput
      {...props}
      ref={ref}
      editable={editable}
      hitSlop={hitSlop ?? (grouped ? 10 : undefined)}
      multiline={multiline}
      placeholderTextColor={theme.colors.outline}
      selectionColor={theme.colors.accent}
      style={[
        styles.base,
        grouped ? styles.grouped : multiline ? styles.textarea : styles.standalone,
        invalid && !grouped ? styles.invalid : undefined,
        !editable ? styles.disabled : undefined,
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    fontSize: theme.typography.row.fontSize,
    lineHeight: theme.typography.row.lineHeight,
    paddingVertical: 0,
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
  textarea: {
    minHeight: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.ringControl,
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLowest,
    paddingHorizontal: 20,
    paddingVertical: theme.spacing.md,
    textAlignVertical: "top",
    boxShadow: theme.shadows.control,
  },
  grouped: { minHeight: 28, backgroundColor: "transparent" },
  invalid: { borderColor: theme.colors.critical },
  disabled: { color: theme.colors.muted, opacity: 0.62 },
});
