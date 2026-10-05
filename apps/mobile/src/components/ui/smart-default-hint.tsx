import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./app-icon";
import { theme } from "@/theme";

export function SmartDefaultHint({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <AppIcon name="check_circle" color={theme.colors.onSurfaceVariant} size={14} />
      <Text style={styles.copy}>Default: {children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.base,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
  },
});
