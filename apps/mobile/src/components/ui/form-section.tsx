import { Children } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { FormPresentationProvider } from "./form-presentation-context";
import { theme } from "@/theme";

export function FormSection({
  action,
  children,
  helper,
  presentation = "grouped",
  style,
  title,
}: {
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly helper?: string;
  readonly presentation?: "grouped" | "plain";
  readonly style?: StyleProp<ViewStyle>;
  readonly title?: string;
}): React.JSX.Element {
  const grouped = presentation === "grouped";
  const childItems = Children.toArray(children);

  return (
    <View style={[styles.section, style]}>
      {title || helper || action ? (
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {helper ? <Text style={styles.helper}>{helper}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <FormPresentationProvider presentation={grouped ? "grouped" : "standalone"}>
        <View style={grouped ? styles.group : styles.plain}>
          {childItems.map((child, index) => (
            <View key={index} style={grouped && index > 0 ? styles.dividedChild : undefined}>
              {child}
            </View>
          ))}
        </View>
      </FormPresentationProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    ...theme.typography.meta,
  },
  helper: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
    ...theme.typography.meta,
  },
  group: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.surface,
  },
  plain: { gap: 10 },
  dividedChild: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.opacityColors.outlineVariant20,
  },
});
