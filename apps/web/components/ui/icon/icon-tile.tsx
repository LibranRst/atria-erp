import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";
import { AppIcon, type AppIconName } from "./app-icon";

export type IconTileTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "info"
  | "attention"
  | "critical"
  | "inverse";

const toneClass: Record<IconTileTone, string> = {
  neutral: "bg-surface-container-low text-on-surface-variant",
  primary: "bg-primary/8 text-primary",
  accent: "bg-accent/8 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning-on-container",
  info: "bg-info/10 text-info",
  attention: "bg-warning-container text-warning-on-container",
  critical: "bg-critical-container text-critical",
  inverse: "bg-white/10 text-white",
};

/** Private frame shared with the Storybook-only icon-family evaluation. */
export function IconTileFrame({
  children,
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & {
  readonly tone?: IconTileTone;
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
      {children}
    </span>
  );
}

export function DuotoneIconTile({
  name,
  iconClassName,
  ...props
}: Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly name: AppIconName | string;
  readonly tone?: IconTileTone;
  readonly iconClassName?: string;
}): React.JSX.Element {
  return (
    <IconTileFrame {...props}>
      <AppIcon name={name} className={cn("icon-lg", iconClassName)} />
    </IconTileFrame>
  );
}
