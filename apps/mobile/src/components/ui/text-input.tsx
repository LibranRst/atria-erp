import { forwardRef, useState } from "react";
import { StyleSheet, TextInput as NativeTextInput } from "react-native";
import type { TextInputProps as NativeTextInputProps } from "react-native";

import { useFormPresentation } from "./form-presentation-context";
import { useFieldRegistration } from "./sheet-form-fields";
import { theme } from "@/theme";

export type TextInputProps = NativeTextInputProps & {
  readonly invalid?: boolean;
};

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput(
  { editable = true, hitSlop, invalid = false, multiline = false, style, ...props },
  ref,
) {
  const { fields, id } = useFieldRegistration();
  const [contentHeight, setContentHeight] = useState(28);
  const grouped = useFormPresentation() === "grouped";

  return (
    <NativeTextInput
      {...props}
      ref={(input) => {
        if (typeof ref === "function") ref(input);
        else if (ref) ref.current = input;
        if (id) fields?.attachInput(id, input);
      }}
      onContentSizeChange={(event) => {
        props.onContentSizeChange?.(event);
        if (multiline) setContentHeight(Math.ceil(event.nativeEvent.contentSize.height));
      }}
      scrollEnabled={!multiline}
      editable={editable}
      hitSlop={hitSlop ?? (grouped ? 10 : undefined)}
      multiline={multiline}
      placeholderTextColor={theme.colors.outline}
      selectionColor={theme.colors.accent}
      style={[
        styles.base,
        grouped ? styles.grouped : multiline ? styles.textarea : styles.standalone,
        multiline && grouped
          ? { minHeight: Math.max(80, contentHeight), textAlignVertical: "top" }
          : undefined,
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
  grouped: {
    minHeight: 32,
    backgroundColor: "transparent",
    ...theme.typography.section,
  },
  invalid: { borderColor: theme.colors.critical },
  disabled: { color: theme.colors.muted, opacity: 0.62 },
});
