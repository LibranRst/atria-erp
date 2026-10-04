import type { NativeMenuItem } from "./action-menu.types";
export type ChromeButtonProps = {
  readonly label: string;
  readonly icon: string;
  readonly systemImage?: NativeMenuItem["systemImage"];
  readonly initials?: string;
  readonly imageUri?: string | null;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly showLabel?: boolean;
  readonly surface?: boolean;
  /** Tonal controls remain legible on solid grouped surfaces. */
  readonly surfaceStyle?: "glass" | "tonal";
  /** Optional smaller visual surface inside the full native touch target. */
  readonly visualSize?: number;
  readonly disabled?: boolean;
  /** iOS: compose the native button inside an existing SwiftUI Host. */
  readonly embedded?: boolean;
  readonly width?: number;
  readonly height?: number;
};
