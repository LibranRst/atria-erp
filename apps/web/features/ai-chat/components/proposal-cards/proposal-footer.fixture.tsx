import React from "react";
import type { SheetFooterAction } from "@/components/ui";

/** Workflow fixtures test permission/confirmation wiring; shared UI has its own tests. */
export function FixtureFooterActions({
  primary,
  secondary,
  primaryFirst = false,
}: {
  readonly primary: SheetFooterAction;
  readonly secondary?: SheetFooterAction;
  readonly primaryFirst?: boolean;
}): React.JSX.Element {
  const actions = secondary
    ? primaryFirst
      ? [primary, secondary]
      : [secondary, primary]
    : [primary];
  return (
    <div>
      {actions.map((action) => (
        <button
          key={action.label}
          disabled={action.disabled || action.pending}
          onClick={action.onClick}
        >
          {action.pending ? (action.pendingLabel ?? "Memproses…") : action.label}
        </button>
      ))}
    </div>
  );
}
