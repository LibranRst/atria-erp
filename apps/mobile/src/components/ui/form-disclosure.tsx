import { transitionSpringSmooth } from "@atria/tokens/motion";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { AppIcon } from "./app-icon";
import { RowAction } from "./row-action";
import { SheetFormFieldsContext } from "./sheet-form-fields";
import { theme } from "@/theme";

export type FormDisclosureProps = {
  readonly title: string;
  readonly description?: string;
  readonly summary?: string;
  readonly icon?: React.ReactNode;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
  readonly fieldIds?: readonly string[];
};

/** Keep the RN control tree mounted so drafts and focus registration survive collapsing. */
export function FormDisclosure({
  title,
  description,
  summary,
  icon,
  expanded,
  onToggle,
  children,
  fieldIds = [],
}: FormDisclosureProps): React.JSX.Element {
  const fields = useContext(SheetFormFieldsContext);
  const reducedMotion = useReducedMotion();
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const rotation = useSharedValue(expanded ? 180 : 0);
  const latest = useRef({ expanded, onToggle });
  const settled = useRef(false);
  const waiting = useRef(new Set<() => void>());
  useLayoutEffect(() => {
    latest.current = { expanded, onToggle };
  }, [expanded, onToggle]);
  const finishReveal = useCallback((): void => {
    if (!latest.current.expanded) return;
    settled.current = true;
    for (const resolve of waiting.current) resolve();
    waiting.current.clear();
  }, []);
  useLayoutEffect(() => {
    const target = expanded ? contentHeight : 0;
    settled.current = false;
    if (reducedMotion) {
      height.set(target);
      rotation.set(expanded ? 180 : 0);
      if (expanded && contentHeight > 0) finishReveal();
      return;
    }
    const spring = {
      stiffness: transitionSpringSmooth.stiffness,
      damping: transitionSpringSmooth.damping,
      mass: transitionSpringSmooth.mass,
    };
    height.set(
      withSpring(target, spring, (finished): void => {
        if (finished && expanded && contentHeight > 0) scheduleOnRN(finishReveal);
      }),
    );
    rotation.set(withSpring(expanded ? 180 : 0, spring));
  }, [expanded, contentHeight, reducedMotion, height, rotation, finishReveal]);

  const fieldKey = fieldIds.join("\u0000");
  useEffect(() => {
    if (!fields || !fieldKey) return undefined;
    const reveal = (): Promise<void> => {
      if (latest.current.expanded && settled.current) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiting.current.add(resolve);
        if (!latest.current.expanded && waiting.current.size === 1) latest.current.onToggle();
      });
    };
    const unregister = fieldKey.split("\u0000").map((id) => fields.registerReveal(id, reveal));
    return (): void => {
      for (const remove of unregister) remove();
    };
  }, [fields, fieldKey]);
  useEffect(() => {
    const pending = waiting.current;
    return (): void => {
      for (const resolve of pending) resolve();
      pending.clear();
    };
  }, []);
  const bodyStyle = useAnimatedStyle(() => ({ height: height.get() }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <View style={styles.container}>
      <RowAction
        accessibilityLabel={[title, summary, expanded ? "Diperluas" : "Diciutkan"]
          .filter(Boolean)
          .join(", ")}
        accessibilityHint={description}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.header}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
          </View>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <Animated.View style={chevronStyle}>
          <AppIcon name="expand_more" color={theme.colors.onSurfaceVariant} size={18} />
        </Animated.View>
      </RowAction>
      <Animated.View
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        pointerEvents={expanded ? "auto" : "none"}
        style={[styles.body, bodyStyle]}
      >
        <View
          collapsable={false}
          onLayout={(event) => {
            const measured = Math.ceil(event.nativeEvent.layout.height);
            if (measured !== contentHeight) setContentHeight(measured);
          }}
          style={styles.content}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0 },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.surface,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.capsule,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  copy: { minWidth: 0, flex: 1, gap: theme.spacing.base },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.base,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  summary: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  body: { overflow: "hidden", minWidth: 0 },
  content: {
    position: "absolute",
    top: 0,
    width: "100%",
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
});
