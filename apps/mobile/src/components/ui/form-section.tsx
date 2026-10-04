import { Children, Fragment, isValidElement } from "react";
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
  function flatten(
    items: React.ReactNode,
    path: readonly string[] = [],
  ): { readonly key: string; readonly node: React.ReactNode }[] {
    return Children.toArray(items).flatMap((child, index) => {
      const childPath = [
        ...path,
        isValidElement(child) ? (child.key ?? String(index)) : String(index),
      ];
      if (isValidElement<{ children?: React.ReactNode }>(child) && child.type === Fragment)
        return flatten(child.props.children, childPath);
      return [{ key: JSON.stringify(childPath), node: child }];
    });
  }
  const childItems = flatten(children);

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
            <View key={child.key} style={grouped && index > 0 ? styles.dividedChild : undefined}>
              {child.node}
            </View>
          ))}
        </View>
      </FormPresentationProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.sm },
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
    ...theme.typography.row,
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
  },
  plain: { gap: theme.spacing.xs },
  dividedChild: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.opacityColors.outlineVariant20,
  },
});
