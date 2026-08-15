import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";
import { AppIcon, type AppIconName } from "./app-icon";

export type IconTileTone = "neutral" | "attention" | "critical" | "inverse";

const toneClass: Record<IconTileTone, string> = {
  neutral: "bg-surface-container-low text-on-surface",
  attention: "bg-warning-container text-warning-on-container",
  critical: "bg-critical-container text-critical",
  inverse: "bg-white/10 text-white",
};

export function DuotoneIconTile({
  name,
  tone = "neutral",
  className,
  iconClassName,
  ...props
}: Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly name: AppIconName | string;
  readonly tone?: IconTileTone;
  readonly iconClassName?: string;
}): React.JSX.Element {
  return (
    <span
      {...props}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-icon",
        toneClass[tone],
        className,
      )}
    >
      <AppIcon name={name} weight="duotone" className={cn("icon-lg", iconClassName)} />
    </span>
  );
}
