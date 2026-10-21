import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";

export type DockTab = {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly selectedSymbol: string;
};
export type DockAction = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly symbol: string;
  readonly disabled: boolean;
  readonly destructive: boolean;
};
export type AtriaNativeDockViewProps = ViewProps & {
  readonly tabs: readonly DockTab[];
  readonly selectedId: string;
  readonly actions: readonly DockAction[];
  readonly onSelect: (event: { readonly nativeEvent: { readonly id: string } }) => void;
  readonly onAction: (event: { readonly nativeEvent: { readonly id: string } }) => void;
};
const NativeView = requireNativeView<AtriaNativeDockViewProps>(
  "AtriaNativeDock",
  "AtriaNativeDockView",
);
export default function AtriaNativeDockView(props: AtriaNativeDockViewProps): React.JSX.Element {
  return <NativeView {...props} />;
}
