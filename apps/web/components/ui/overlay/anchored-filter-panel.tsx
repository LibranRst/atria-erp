"use client";

import React from "react";

import { ContextPopover, type AnchoredTrigger } from "./anchored-surfaces";

export function AnchoredFilterPanel({
  open,
  trigger,
  title,
  children,
  actions,
  onOpenChange,
  onDismiss,
}: {
  readonly open: boolean;
  readonly trigger: AnchoredTrigger;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly actions: React.ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  function changeOpen(nextOpen: boolean): void {
    if (!nextOpen && open) onDismiss();
    onOpenChange(nextOpen);
  }

  return (
    <ContextPopover
      open={open}
      trigger={trigger}
      label={title}
      placement="bottom-end"
      onOpenChange={changeOpen}
    >
      <div className="min-w-0">
        <p className="text-row font-bold text-on-surface">{title}</p>
        <div className="mt-3 space-y-3">{children}</div>
        <div className="mt-4">{actions}</div>
      </div>
    </ContextPopover>
  );
}
