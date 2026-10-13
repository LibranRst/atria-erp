import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";
import type { ActionMenuProps } from "./action-menu.types";
import { nativeIconImageData } from "@atria/icons/native-images";

type NativeActionMenuProps = ViewProps & {
  readonly title: string;
  readonly iconData: string;
  readonly primary: boolean;
  readonly menuLabel: string;
  readonly actions: readonly {
    readonly id: string;
    readonly label: string;
    readonly iconData: string;
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
      iconData={nativeIcon ? nativeIconImageData(nativeIcon === "plus" ? "add" : "more_horiz") : ""}
      primary={tone === "primary"}
      menuLabel={accessibilityLabel}
      actions={items.map((item) => ({
        id: item.id,
        label: item.label,
        iconData: nativeIconImageData(item.icon),
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
