import { HugeiconsIcon, type HugeiconsProps } from "@hugeicons/react-native";
import {
  APP_ICON_STROKE_WIDTH,
  resolveAppIcon,
  type AppIconName,
  type AppIconWeight,
} from "@atria/icons";

export type { AppIconName } from "@atria/icons";

export type AppIconProps = Omit<HugeiconsProps, "icon" | "strokeWidth"> & {
  readonly name: AppIconName | string;
  /** Compatibility only: the free family always renders Stroke Rounded. */
  readonly weight?: AppIconWeight;
  readonly mirrored?: boolean;
};

export function AppIcon({
  name,
  size = 18,
  weight,
  mirrored = false,
  style,
  ...props
}: AppIconProps): React.JSX.Element {
  void weight;
  return (
    <HugeiconsIcon
      {...props}
      icon={resolveAppIcon(name)}
      size={size}
      strokeWidth={APP_ICON_STROKE_WIDTH}
      style={mirrored ? [style, { transform: [{ scaleX: -1 }] }] : style}
    />
  );
}
