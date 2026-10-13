"use client";

import type { ComponentPropsWithoutRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { APP_ICON_STROKE_WIDTH, resolveAppIcon } from "@atria/icons";

export function AppIcon({
  name,
  size = 18,
  ...props
}: Omit<ComponentPropsWithoutRef<"svg">, "children"> & {
  readonly name: string;
  readonly size?: number;
}): React.JSX.Element {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      {...props}
      icon={resolveAppIcon(name)}
      size={size}
      strokeWidth={APP_ICON_STROKE_WIDTH}
    />
  );
}
