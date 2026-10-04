import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { DialogFrame } from "./dialog-frame";
import { FactRow, GroupedSurface } from "./grouped-surface";
import { theme } from "@/theme";

export type SuccessDialogProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly facts?: readonly { readonly label: string; readonly value: string }[];
  readonly actionLabel?: string;
  readonly onAction?: () => void;
};
export function SuccessDialog({
  visible,
  onClose,
  title,
  description,
  facts = [],
  actionLabel = "Selesai",
  onAction,
}: SuccessDialogProps): React.JSX.Element {
  return (
    <DialogFrame
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button onPress={onAction ?? onClose}>{actionLabel}</Button>}
    >
      <View style={styles.message}>
        <AppIcon name="check_circle" color={theme.colors.accent} size={32} />
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {facts.length > 0 ? (
        <GroupedSurface>
          {facts.slice(0, 4).map((fact) => (
            <FactRow key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </GroupedSurface>
      ) : null}
    </DialogFrame>
  );
}
const styles = StyleSheet.create({
  message: { gap: theme.spacing.sm },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
});
