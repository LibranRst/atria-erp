import { clampDateOnly, formatDateOnly, parseDateOnly } from "@atria/core/presentation/date-only";
import { calendarMonthOf } from "@atria/core/presentation/calendar-month";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "./button";
import { ChromeButton } from "./chrome-button";
import { CalendarContent } from "./calendar-content";
import { DialogFrame } from "./dialog-frame";
import { SheetSelect } from "./sheet-select";
import { useFieldRegistration } from "./sheet-form-fields";
import { theme } from "@/theme";

export type CalendarDialogProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly minimumDate?: string;
  readonly maximumDate?: string;
  readonly allowClear?: boolean;
  readonly returnFocusField?: string;
};

export function CalendarDialog({
  visible,
  title,
  value,
  onChange,
  onClose,
  minimumDate,
  maximumDate,
  allowClear = false,
  returnFocusField,
}: CalendarDialogProps): React.JSX.Element {
  const today = formatDateOnly(new Date());
  const initialDraft = clampDateOnly(value || today, minimumDate, maximumDate);
  const initialMonth = calendarMonthOf(
    initialDraft || clampDateOnly(today, minimumDate, maximumDate) || today,
  );
  const [session, setSession] = useState({
    visible,
    draft: initialDraft,
    month: initialMonth,
  });
  if (visible !== session.visible)
    setSession({
      visible,
      draft: visible ? initialDraft : session.draft,
      month: visible ? initialMonth : session.month,
    });
  const draft = session.draft;
  const setDraft = (next: string): void =>
    setSession((current) => ({
      ...current,
      draft: next,
      month: parseDateOnly(next) ? calendarMonthOf(next) : current.month,
    }));
  const todayValid = clampDateOnly(today, minimumDate, maximumDate) === today;
  const { fields } = useFieldRegistration();
  const restore = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (visible) {
      restore.current = fields?.captureReadingPosition(returnFocusField);
      Keyboard.dismiss();
    } else {
      const callback = restore.current;
      restore.current = undefined;
      requestAnimationFrame(() => callback?.());
    }
  }, [visible, fields, returnFocusField]);
  const valid =
    parseDateOnly(draft) !== null && clampDateOnly(draft, minimumDate, maximumDate) === draft;
  if (Platform.OS === "android")
    return visible ? (
      <CalendarContent
        value={draft}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onClose={onClose}
        onChange={(selected) => {
          onChange(selected);
          onClose();
        }}
      />
    ) : (
      <></>
    );
  return (
    <DialogFrame
      visible={visible}
      onClose={onClose}
      title={title}
      presentation="calendar"
      returnFocusField={returnFocusField}
      headerAction={
        <Button
          size="compact"
          variant="secondary"
          disabled={!todayValid}
          onPress={() => setDraft(today)}
        >
          Hari Ini
        </Button>
      }
    >
      <View style={styles.calendar}>
        <CalendarContent
          value={draft}
          month={session.month}
          onMonthChange={(month) => setSession((current) => ({ ...current, month }))}
          onChange={setDraft}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
        {draft && !valid ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Pilih tanggal dalam rentang yang tersedia.
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            size="sheet"
            disabled={!valid}
            onPress={() => {
              onChange(draft);
              onClose();
            }}
          >
            Gunakan tanggal
          </Button>
          {allowClear && value ? (
            <Button
              size="compact"
              style={styles.clear}
              variant="ghost"
              onPress={() => {
                onChange("");
                onClose();
              }}
            >
              Hapus tanggal
            </Button>
          ) : null}
        </View>
      </View>
    </DialogFrame>
  );
}

export type DatePickerFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly fieldId?: string;
  readonly error?: string;
  readonly helper?: string;
  readonly optional?: boolean;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly minimumDate?: string;
  readonly maximumDate?: string;
  readonly placeholder?: string;
};
export function DatePickerField({
  minimumDate,
  maximumDate,
  ...props
}: DatePickerFieldProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const selected = parseDateOnly(props.value);
  const label = selected?.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <SheetSelect
            {...props}
            options={props.value ? [{ value: props.value, label: label ?? props.value }] : []}
            placeholder={props.placeholder ?? "Pilih tanggal"}
            onPress={() => setVisible(true)}
          />
        </View>
        {Platform.OS === "android" &&
        props.optional &&
        props.value &&
        !props.disabled &&
        !props.readOnly ? (
          <ChromeButton
            label={`Hapus ${props.label.toLocaleLowerCase("id-ID")}`}
            icon="close"
            systemImage="xmark"
            surface={false}
            onPress={() => props.onChange("")}
          />
        ) : null}
      </View>
      <CalendarDialog
        visible={visible}
        onClose={() => setVisible(false)}
        title={props.label}
        value={props.value}
        onChange={props.onChange}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        allowClear={Boolean(props.optional)}
        returnFocusField={props.fieldId}
      />
    </>
  );
}
const styles = StyleSheet.create({
  fieldRow: { flexDirection: "row", alignItems: "center" },
  field: { flex: 1, minWidth: 0 },
  clear: { alignSelf: "center" },
  calendar: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: 24,
    overflow: "hidden",
  },
  actions: {
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  error: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
});
