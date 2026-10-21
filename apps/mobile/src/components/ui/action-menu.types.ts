import type { ComponentProps, ReactElement } from "react";
import type { Button } from "@expo/ui/swift-ui";

export type NativeMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon: string;
  readonly systemImage?: ComponentProps<typeof Button>["systemImage"];
  readonly selectedSystemImage?: ComponentProps<typeof Button>["systemImage"];
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly selected?: boolean;
  readonly destinationTitle?: string;
  readonly onPress: () => void;
};

export type ActionMenuProps = {
  readonly accessibilityLabel: string;
  readonly children: ReactElement;
  readonly items: readonly NativeMenuItem[];
  readonly width: number;
  readonly height?: number;
  readonly nativeTitle?: string;
  readonly nativeIcon?: NativeMenuItem["systemImage"];
  readonly tone?: "neutral" | "primary";
};
