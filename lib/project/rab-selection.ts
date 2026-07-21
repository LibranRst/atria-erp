export interface RabSelectionCandidate {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
}

function latestByRevision<T extends RabSelectionCandidate>(rows: readonly T[]): T | null {
  return rows.reduce<T | null>(
    (latest, row) => (latest === null || row.revision > latest.revision ? row : latest),
    null,
  );
}

export function selectCurrentRabEstimate<T extends RabSelectionCandidate>(
  estimates: readonly T[],
): T | null {
  const draft = latestByRevision(estimates.filter((estimate) => estimate.status === "DRAFT"));
  if (draft) return draft;
  const approved = latestByRevision(estimates.filter((estimate) => estimate.status === "APPROVED"));
  if (approved) return approved;
  return latestByRevision(estimates.filter((estimate) => estimate.status !== "VOID"));
}

export function selectApprovedRabEstimate<T extends RabSelectionCandidate>(
  estimates: readonly T[],
): T | null {
  return latestByRevision(estimates.filter((estimate) => estimate.status === "APPROVED"));
}

export function getNextRabRevision(estimates: readonly RabSelectionCandidate[]): number {
  return (latestByRevision(estimates)?.revision ?? 0) + 1;
}

export function assertRabRevisionCanBeVoided(revision: {
  readonly status: string;
  readonly supersedesRabEstimateId: string | null;
}): void {
  if (revision.status !== "DRAFT" || !revision.supersedesRabEstimateId) {
    throw new Error("Hanya revisi RAB DRAFT yang dapat dibatalkan.");
  }
}

export function isOpenChangeOrderStatus(status: string): boolean {
  return ["DRAFT", "PENDING_CLIENT", "PENDING_APPROVAL"].includes(status);
}
