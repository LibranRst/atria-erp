import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActionMenuProps } from "./action-menu.types";
import { AppIcon } from "./app-icon";
import { RowAction } from "./row-action";
import { theme } from "@/theme";

/** Fallback Atria bergaya iOS; Android back/dismissal dimiliki Modal native. */
export function ActionMenu({
  accessibilityLabel,
  children,
  items,
  width,
  height = 48,
}: ActionMenuProps): React.JSX.Element {
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const menuWidth = Math.min(280, window.width - theme.spacing.marginMobile * 2);
  const menuHeight = Math.min(
    items.length * 64 + 16,
    window.height - insets.top - insets.bottom - 32,
  );
  const top = anchor
    ? Math.min(Math.max(insets.top + 8, anchor.y), window.height - insets.bottom - menuHeight - 8)
    : 0;
  const left = anchor ? Math.min(Math.max(20, anchor.x), window.width - menuWidth - 20) : 0;
  return (
    <>
      <View ref={trigger} collapsable={false} style={{ width, height }}>
        <RowAction
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: anchor !== null }}
          style={{ width, height }}
          onPress={() =>
            trigger.current?.measureInWindow((x, y) => setAnchor({ x, y: y + height }))
          }
        >
          {children}
        </RowAction>
      </View>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="none"
        onRequestClose={() => setAnchor(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Tutup menu"
            style={StyleSheet.absoluteFill}
            onPress={() => setAnchor(null)}
          />
          <ScrollView
            accessibilityViewIsModal
            style={[styles.menu, { top, left, width: menuWidth, maxHeight: menuHeight }]}
            contentContainerStyle={styles.content}
          >
            {items.map((item) => (
              <RowAction
                key={item.id}
                disabled={item.disabled}
                accessibilityLabel={item.label}
                accessibilityHint={item.description}
                selected={item.selected}
                accessibilityState={{ disabled: item.disabled, selected: item.selected }}
                onPress={() => {
                  setAnchor(null);
                  item.onPress();
                }}
                style={[styles.row, item.disabled && styles.disabled]}
              >
                <AppIcon
                  name={item.icon}
                  weight={item.selected ? "fill" : "regular"}
                  color={item.destructive ? theme.colors.critical : theme.colors.onSurface}
                />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={[styles.label, item.destructive && styles.danger]}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text style={styles.description}>{item.description}</Text>
                  ) : null}
                </View>
              </RowAction>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  menu: {
    position: "absolute",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.raised,
  },
  content: { padding: theme.spacing.xs },
  row: {
    minHeight: 48,
    borderRadius: theme.radii.capsule,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  description: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  disabled: { opacity: 0.45 },
  danger: { color: theme.colors.critical },
});
