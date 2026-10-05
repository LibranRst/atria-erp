import type { ReactNode } from "react";
import type { AccessibilityState, StyleProp, ViewStyle } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "section";
export type ButtonSize = "regular" | "compact" | "sheet";

/** Native controls expose actions, rather than synthetic RN press events. */
export type ButtonProps = {
  readonly children: string;
  readonly onPress?: () => void;
  /** Decorative leading icon, hosted in a bounded native slot. */
  readonly leading?: ReactNode;
  /** Decorative trailing icon; the native button remains the only action. */
  readonly trailing?: ReactNode;
  /** Native iOS counterpart of the decorative trailing icon. */
  readonly trailingSystemImage?: SFSymbol;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly variant?: ButtonVariant;
  /** Compact header, regular page, or fuller sheet action. Inherits the sheet owner's default. */
  readonly size?: ButtonSize;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityState?: AccessibilityState;
  readonly testID?: string;
};
