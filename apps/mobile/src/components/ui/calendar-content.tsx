import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { formatDateOnly, parseDateOnly } from "@atria/core/presentation/date-only";
import { Platform } from "react-native";
import { FormField } from "./form-field";
import { TextInput } from "./text-input";
import type { CalendarContentProps } from "./calendar-content.types";

export function CalendarContent({
  value,
  onChange,
  onClose,
  minimumDate,
  maximumDate,
}: CalendarContentProps): React.JSX.Element {
  if (Platform.OS === "web")
    return (
      <FormField label="Tanggal" helper="YYYY-MM-DD">
        <TextInput
          accessibilityLabel="Tanggal"
          value={value}
          onChangeText={onChange}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </FormField>
    );
  return (
    <DateTimePicker
      style={{ width: 48, height: 48 }}
      value={parseDateOnly(value) ?? new Date()}
      mode="date"
      presentation="dialog"
      display="default"
      minimumDate={minimumDate ? (parseDateOnly(minimumDate) ?? undefined) : undefined}
      maximumDate={maximumDate ? (parseDateOnly(maximumDate) ?? undefined) : undefined}
      positiveButton={{ label: "Gunakan tanggal" }}
      negativeButton={{ label: "Batal" }}
      onValueChange={(_event, date) => onChange(formatDateOnly(date))}
      onDismiss={onClose}
    />
  );
}
