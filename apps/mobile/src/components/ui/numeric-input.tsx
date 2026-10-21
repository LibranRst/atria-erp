import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { numericDraftHasUncommittedEdits, parseNumericDraft } from "./numeric-input-state";
import { FormFieldIdContext, useFieldRegistration } from "./sheet-form-fields";
import { TextInput } from "./text-input";
import { theme } from "@/theme";

export type NumericInputProps = {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly accessibilityLabel: string;
  readonly fieldId?: string;
  readonly min?: number;
  readonly max?: number;
  readonly strictlyPositive?: boolean;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly placeholder?: string;
  readonly suffix?: string;
};

export function NumericInput({
  value,
  onChange,
  accessibilityLabel,
  fieldId,
  min,
  max,
  strictlyPositive = false,
  disabled = false,
  error,
  placeholder = "0",
  suffix,
}: NumericInputProps): React.JSX.Element {
  const { fields, id: inheritedId } = useFieldRegistration();
  const id = fieldId ?? inheritedId;
  const [draft, setDraft] = useState<{
    readonly sourceValue: number;
    readonly raw: string;
    readonly error: string | null;
  }>({ sourceValue: value, raw: String(value), error: null });
  if (draft.sourceValue !== value) {
    const parsed = parseNumericDraft(draft.raw, { min, max, strictlyPositive });
    // Accepted formatting survives; a genuine external update replaces the local draft.
    setDraft({
      sourceValue: value,
      raw: parsed.kind === "valid" && parsed.value === value ? draft.raw : String(value),
      error: null,
    });
  }
  const { raw, error: localError } = draft;
  const latest = useRef({ raw, value, min, max, strictlyPositive, disabled });
  useLayoutEffect(() => {
    latest.current = { raw, value, min, max, strictlyPositive, disabled };
    fields?.notifyControlState();
  }, [raw, value, min, max, strictlyPositive, disabled, fields]);

  useLayoutEffect(() => {
    if (!fields || !id) return undefined;
    return fields.registerControl(id, {
      validate: (): string | null => {
        if (latest.current.disabled) return null;
        const parsed = parseNumericDraft(latest.current.raw, latest.current);
        return parsed.kind === "valid" ? null : parsed.error;
      },
      hasUncommittedEdits: (): boolean =>
        numericDraftHasUncommittedEdits(latest.current.raw, latest.current.value, latest.current),
    });
  }, [fields, id]);

  const change = useCallback(
    (next: string): void => {
      latest.current.raw = next;
      setDraft((current) => ({ ...current, raw: next, error: null }));
      const parsed = parseNumericDraft(next, { min, max, strictlyPositive });
      if (parsed.kind === "valid") onChange(parsed.value);
      fields?.notifyControlState();
    },
    [min, max, strictlyPositive, onChange, fields],
  );
  const attachView = useCallback(
    (view: View | null): void => {
      if (fieldId && fieldId !== inheritedId) fields?.attachView(fieldId, view);
    },
    [fieldId, inheritedId, fields],
  );
  return (
    <View collapsable={false} ref={attachView} style={styles.container}>
      <View style={styles.row}>
        <FormFieldIdContext.Provider value={id}>
          <TextInput
            accessibilityLabel={accessibilityLabel}
            editable={!disabled}
            keyboardType={
              strictlyPositive || (min !== undefined && min >= 0)
                ? "decimal-pad"
                : "numbers-and-punctuation"
            }
            invalid={Boolean(error || localError)}
            onChangeText={change}
            onBlur={() => {
              const parsed = parseNumericDraft(latest.current.raw, { min, max, strictlyPositive });
              if (parsed.kind !== "valid")
                setDraft((current) => ({ ...current, error: parsed.error }));
              else {
                latest.current.raw = String(parsed.value);
                setDraft((current) => ({ ...current, raw: String(parsed.value), error: null }));
              }
              fields?.notifyControlState();
            }}
            placeholder={placeholder}
            style={styles.input}
            value={raw}
          />
        </FormFieldIdContext.Provider>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {!error && localError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {localError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0, gap: theme.spacing.base },
  row: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: theme.spacing.base },
  input: { flex: 1, minWidth: 0, fontVariant: ["tabular-nums"] },
  suffix: { color: theme.colors.onSurfaceVariant, ...theme.typography.support },
  error: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
});
