import { View } from "react-native";
import { ActionMenu } from "./action-menu";
import { AppIcon } from "./app-icon";
import { ChromeButton } from "./chrome-button";
import { ChromeSurface } from "./chrome-surface";
import type { NativeNavigationDockProps } from "./native-navigation-dock.types";
import { theme } from "@/theme";
export type {
  NativeNavigationDockProps,
  NativeNavigationTab,
} from "./native-navigation-dock.types";

/** Android/web compose the existing shared controls; iOS resolves to UIKit. */
export function NativeNavigationDock({
  tabs,
  selectedId,
  actions,
  onSelect,
  width,
  height,
}: NativeNavigationDockProps): React.JSX.Element {
  const hasActions = actions.length > 0;
  const tabWidth =
    (width - (hasActions ? height + theme.spacing.sm : 0) - theme.spacing.base * 2) /
    Math.max(tabs.length, 1);
  return (
    <View
      style={{ width, height, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}
    >
      <ChromeSurface
        accessibilityRole="tablist"
        accessibilityLabel="Navigasi utama"
        style={{ flexDirection: "row", padding: theme.spacing.base }}
      >
        {tabs.map((tab) => (
          <ChromeButton
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            systemImage={selectedId === tab.id ? tab.selectedSystemImage : tab.systemImage}
            selected={selectedId === tab.id}
            showLabel
            surface={false}
            width={tabWidth}
            height={height - theme.spacing.base * 2}
            onPress={() => onSelect(tab.id)}
          />
        ))}
      </ChromeSurface>
      {hasActions ? (
        <ActionMenu
          accessibilityLabel="Aksi cepat"
          items={actions}
          width={height}
          height={height}
          nativeIcon="plus"
          tone="primary"
        >
          <ChromeSurface
            style={{ width: height, height, alignItems: "center", justifyContent: "center" }}
          >
            <AppIcon name="add" size={28} color={theme.colors.primary} />
          </ChromeSurface>
        </ActionMenu>
      ) : null}
    </View>
  );
}
