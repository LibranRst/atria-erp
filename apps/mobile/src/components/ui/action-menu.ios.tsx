import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";
import type { ActionMenuProps } from "./action-menu.types";

type NativeActionMenuProps = ViewProps & {
  readonly title: string;
  readonly symbol: string;
  readonly primary: boolean;
  readonly menuLabel: string;
  readonly actions: readonly {
    readonly id: string;
    readonly label: string;
    readonly symbol: string;
    readonly selectedSymbol: string;
    readonly disabled: boolean;
    readonly destructive: boolean;
    readonly selected: boolean;
    readonly destinationTitle: string;
  }[];
  readonly onAction: (event: { readonly nativeEvent: { readonly id: string } }) => void;
};
const NativeMenu = requireNativeView<NativeActionMenuProps>(
  "AtriaNativeDock",
  "AtriaNativeActionMenuView",
);

/** One persistent native anchor can navigate while its system menu closes. */
export function ActionMenu({
  accessibilityLabel,
  items,
  width,
  height = 48,
  nativeTitle,
  nativeIcon,
  tone = "neutral",
}: ActionMenuProps): React.JSX.Element {
  return (
    <NativeMenu
      style={{ width, height, overflow: "visible" }}
      title={nativeTitle ?? ""}
      symbol={nativeIcon ?? ""}
      primary={tone === "primary"}
      menuLabel={accessibilityLabel}
      actions={items.map((item) => ({
        id: item.id,
        label: item.label,
        symbol: item.systemImage ?? "",
        selectedSymbol: item.selectedSystemImage ?? item.systemImage ?? "",
        disabled: item.disabled ?? false,
        destructive: item.destructive ?? false,
        selected: item.selected ?? false,
        destinationTitle: item.destinationTitle ?? "",
      }))}
      onAction={(event) => {
        const item = items.find((item) => item.id === event.nativeEvent.id);
        if (item && !item.disabled) item.onPress();
      }}
    />
  );
}
