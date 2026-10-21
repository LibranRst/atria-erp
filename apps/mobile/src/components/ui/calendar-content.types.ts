export type CalendarContentProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly minimumDate?: string;
  readonly maximumDate?: string;
  readonly month?: string;
  readonly onMonthChange?: (month: string) => void;
  readonly onClose?: () => void;
};
