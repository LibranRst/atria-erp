import type { ReactNode } from "react";
import type { AccessibilityState, StyleProp, ViewStyle } from "react-native";

/** One action per row/card. Put secondary actions beside it, never inside it. */
export type RowActionProps = {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly accessibilityState?: AccessibilityState;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly testID?: string;
};
