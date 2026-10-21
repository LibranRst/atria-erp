import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";

export type NativeSegmentedOption = {
  readonly id: string;
  readonly label: string;
  readonly iconData: string;
  readonly badge: number;
  readonly disabled: boolean;
};

export type NativeSegmentedTabsProps = ViewProps & {
  readonly options: readonly NativeSegmentedOption[];
  readonly selectedId: string;
  readonly scrollable: boolean;
  readonly controlLabel: string;
  readonly activeColor: string;
  readonly motion: {
    readonly stiffness: number;
    readonly damping: number;
    readonly mass: number;
    readonly duration: number;
  };
  readonly onSelect: (event: { readonly nativeEvent: { readonly id: string } }) => void;
};

const NativeView = requireNativeView<NativeSegmentedTabsProps>(
  "AtriaNativeDock",
  "AtriaNativeSegmentedTabsView",
);

export function AtriaNativeSegmentedTabsView(props: NativeSegmentedTabsProps): React.JSX.Element {
  return <NativeView {...props} />;
}
