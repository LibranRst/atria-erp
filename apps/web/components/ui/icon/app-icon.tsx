"use client";

import type { ComponentPropsWithoutRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  APP_ICON_STROKE_WIDTH,
  resolveAppIcon,
  type AppIconName,
  type AppIconWeight,
} from "@atria/icons";

export type { AppIconName } from "@atria/icons";

export type AppIconProps = Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
  readonly name: AppIconName | string;
  /** Compatibility only: the free family always renders Stroke Rounded. */
  readonly weight?: AppIconWeight;
};

export function AppIcon({
  name,
  weight,
  className = "",
  ...props
}: AppIconProps): React.JSX.Element {
  // Consume the old prop rather than forwarding an unsupported SVG attribute.
  void weight;
  return (
    <HugeiconsIcon
      aria-hidden="true"
      icon={resolveAppIcon(name)}
      size="1em"
      className={className}
      {...props}
      strokeWidth={APP_ICON_STROKE_WIDTH}
    />
  );
}
