"use client";

import { Button, GroupedSurface, InlineStateRow } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

/** Blocking review context belongs with the reviewed content, before business actions. */
export function ProposalReviewFeedback({
  message,
  title = "Belum bisa dilanjutkan",
  recovery,
  embedded = false,
}: {
  readonly message: string;
  readonly embedded?: boolean;
  readonly title?: string;
  readonly recovery?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
  };
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const action = recovery ? (
    <Button variant="quiet" size="compact" disabled={recovery.disabled} onClick={recovery.onClick}>
      {recovery.label}
    </Button>
  ) : undefined;
  const content = (
    <div role="alert" data-proposal-review-feedback="true">
      <InlineStateRow
        icon="error"
        title={title}
        description={message}
        tone="critical"
        action={action}
        actionPlacement={desktop ? "trailing" : "below"}
      />
    </div>
  );
  return embedded ? content : <GroupedSurface>{content}</GroupedSurface>;
}
