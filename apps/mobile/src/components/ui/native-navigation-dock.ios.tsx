import AtriaNativeDockView from "../../../modules/atria-native-dock/src/atria-native-dock-view";
import type { NativeNavigationDockProps } from "./native-navigation-dock.types";
import { theme } from "@/theme";

/** UIKit owns both tab selection/scrubbing and the primary-action menu. */
export function NativeNavigationDock({
  tabs,
  selectedId,
  actions,
  onSelect,
  width,
  height,
}: NativeNavigationDockProps): React.JSX.Element {
  return (
    <AtriaNativeDockView
      style={{ width, height, ...theme.nativeShadows.floating }}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        symbol: tab.systemImage,
        selectedSymbol: tab.selectedSystemImage,
      }))}
      selectedId={selectedId}
      actions={actions.map((action) => ({
        id: action.id,
        label: action.label,
        description: action.description ?? "",
        symbol: action.systemImage ?? "",
        disabled: action.disabled ?? false,
        destructive: action.destructive ?? false,
      }))}
      onSelect={(event) => onSelect(event.nativeEvent.id)}
      onAction={(event) => {
        const action = actions.find((item) => item.id === event.nativeEvent.id);
        if (action && !action.disabled) action.onPress();
      }}
    />
  );
}
