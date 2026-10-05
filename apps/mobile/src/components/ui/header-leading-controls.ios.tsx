import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";
import type { HeaderLeadingControlsProps } from "./header-leading-controls.types";

type NativeProps = ViewProps & {
  readonly hasBack: boolean;
  readonly canUseAI: boolean;
  readonly onAction: (event: { readonly nativeEvent: { readonly id: string } }) => void;
};
const NativeLeading = requireNativeView<NativeProps>(
  "AtriaNativeDock",
  "AtriaHeaderLeadingControlsView",
);

/** UIKit animates stable glass controls independently of page navigation. */
export function HeaderLeadingControls({
  hasBack,
  canUseAI,
  onBack,
  onAI,
}: HeaderLeadingControlsProps): React.JSX.Element {
  return (
    <NativeLeading
      style={{ width: 136, height: 48 }}
      hasBack={hasBack}
      canUseAI={canUseAI}
      onAction={(event) => {
        if (event.nativeEvent.id === "back" && hasBack) onBack();
        if (event.nativeEvent.id === "ai" && canUseAI) onAI();
      }}
    />
  );
}
