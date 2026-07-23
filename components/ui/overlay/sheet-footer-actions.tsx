"use client";

import type { ReactNode } from "react";

import { Button, type ButtonVariant } from "../button/button";

type SheetFooterAction = {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly form?: string;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
};

type SheetFooterActionsProps = {
  readonly primary: SheetFooterAction & {
    readonly variant?: Extract<ButtonVariant, "primary" | "critical">;
  };
  readonly secondary?: SheetFooterAction;
  readonly status?: ReactNode;
  readonly disabledReason?: string;
};

export function SheetFooterActions({
  primary,
  secondary,
  status,
  disabledReason,
}: SheetFooterActionsProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {status ? <div className="px-1">{status}</div> : null}
      {disabledReason ? (
        <p className="px-1 text-[10px] leading-4 font-medium text-on-surface-variant">
          {disabledReason}
        </p>
      ) : null}
      {secondary ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type={secondary.type ?? "button"}
            form={secondary.form}
            onClick={secondary.onClick}
            disabled={secondary.disabled}
            pending={secondary.pending}
            pendingLabel={secondary.pendingLabel}
            variant="secondary"
            fullWidth
            className="min-w-0"
          >
            {secondary.label}
          </Button>
          <Button
            type={primary.type ?? "button"}
            form={primary.form}
            onClick={primary.onClick}
            disabled={primary.disabled}
            pending={primary.pending}
            pendingLabel={primary.pendingLabel}
            variant={primary.variant ?? "primary"}
            fullWidth
            className="min-w-0"
          >
            {primary.label}
          </Button>
        </div>
      ) : (
        <Button
          type={primary.type ?? "button"}
          form={primary.form}
          onClick={primary.onClick}
          disabled={primary.disabled}
          pending={primary.pending}
          pendingLabel={primary.pendingLabel}
          variant={primary.variant ?? "primary"}
          fullWidth
        >
          {primary.label}
        </Button>
      )}
    </div>
  );
}
