import { useNavigation } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import type { NativeStackNavigationOptions } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ActionMenu } from "./action-menu";
import { AppIcon } from "./app-icon";
import { ChromeButton } from "./chrome-button";
import type { NativeMenuItem } from "./action-menu.types";
import { theme } from "@/theme";
import { nativeIconImageSource } from "@atria/icons/native-images";

function FloatingSheetTitle({
  title,
  actions = 0,
}: {
  readonly title: string;
  readonly actions?: number;
}): React.JSX.Element {
  const viewport = useWindowDimensions();
  return (
    <View
      style={[
        styles.floatingTitle,
        { maxWidth: Math.max(100, viewport.width - (actions ? 224 : 144)) },
      ]}
    >
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

export function sheetHeaderOptions(
  title: string,
  onClose: () => void,
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    title,
    headerTitle: Platform.OS === "ios" ? () => <FloatingSheetTitle title={title} /> : title,
    headerTransparent: Platform.OS === "ios",
    headerLargeTitle: false,
    headerBackVisible: false,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: Platform.OS === "ios" ? "transparent" : theme.colors.surfaceContainerLow,
    },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: { fontSize: 17, fontWeight: "600" },
    headerLeft: () => null,
    headerRight: () => (
      <ChromeButton label="Tutup" icon="close" systemImage="xmark" onPress={onClose} />
    ),
    ...(Platform.OS === "ios"
      ? {
          scrollEdgeEffects: { top: "soft", bottom: "hidden", left: "hidden", right: "hidden" },
          unstable_headerRightItems: () => [
            {
              type: "button",
              label: "Tutup",
              icon: { type: "image", source: nativeIconImageSource("close"), tinted: true },
              accessibilityLabel: "Tutup",
              onPress: onClose,
              sharesBackground: false,
            },
          ],
        }
      : {}),
  };
}

export function useSheetHeader({
  title,
  onClose,
  pending,
  actions = [],
  actionLabel = "Aksi form",
}: {
  readonly title?: string;
  readonly onClose: () => void;
  readonly pending?: boolean;
  readonly actions?: readonly NativeMenuItem[];
  readonly actionLabel?: string;
}): void {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const latestActions = useRef(actions);
  useLayoutEffect(() => {
    latestActions.current = actions;
  }, [actions]);
  const actionKey = JSON.stringify(
    actions.map(({ id, label, description, icon, systemImage, disabled, destructive }) => ({
      id,
      label,
      description,
      icon,
      systemImage,
      disabled,
      destructive,
    })),
  );
  useLayoutEffect(() => {
    // Preloaded route placeholders cannot update navigation options yet.
    if (!focused) return;
    const headerActions = latestActions.current.map((action) => ({
      ...action,
      onPress: (): void => {
        latestActions.current.find((item) => item.id === action.id)?.onPress();
      },
    }));
    const options: NativeStackNavigationOptions = {
      ...(title
        ? {
            title,
            headerTitle:
              Platform.OS === "ios"
                ? () => <FloatingSheetTitle title={title} actions={headerActions.length} />
                : title,
          }
        : {}),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {headerActions.length ? (
            <ActionMenu
              accessibilityLabel={actionLabel}
              items={headerActions.map((action) => ({
                ...action,
                disabled: pending || action.disabled,
              }))}
              nativeIcon="ellipsis"
              width={48}
            >
              <AppIcon name="more_horiz" color={theme.colors.onSurface} size={20} />
            </ActionMenu>
          ) : null}
          <ChromeButton label="Tutup" icon="close" systemImage="xmark" onPress={onClose} />
        </View>
      ),
      ...(Platform.OS === "ios"
        ? {
            unstable_headerRightItems: () => [
              ...(headerActions.length
                ? [
                    {
                      type: "menu" as const,
                      label: actionLabel,
                      icon: {
                        type: "image" as const,
                        source: nativeIconImageSource("more_horiz"),
                        tinted: true,
                      },
                      accessibilityLabel: actionLabel,
                      sharesBackground: false,
                      menu: {
                        title: actionLabel,
                        items: headerActions.map((action) => ({
                          type: "action" as const,
                          label: action.label,
                          icon: {
                            type: "image" as const,
                            source: nativeIconImageSource(action.icon),
                            tinted: true,
                          },
                          disabled: pending || action.disabled,
                          destructive: action.destructive,
                          onPress: action.onPress,
                        })),
                      },
                    },
                  ]
                : []),
              {
                type: "button",
                label: "Tutup",
                icon: { type: "image", source: nativeIconImageSource("close"), tinted: true },
                accessibilityLabel: "Tutup",
                onPress: onClose,
                disabled: pending,
                sharesBackground: false,
              },
            ],
          }
        : {}),
    };
    navigation.setOptions(options);
  }, [focused, navigation, title, onClose, pending, actionKey, actionLabel]);
}

const styles = StyleSheet.create({
  floatingTitle: {
    height: 40,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  title: { color: theme.colors.onSurface, fontSize: 17, fontWeight: "600", flexShrink: 1 },
});
