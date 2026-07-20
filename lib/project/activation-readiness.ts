export type ActivationRap = {
  readonly id: string;
  readonly status: string;
};

export type ActivationRab = {
  readonly status: string;
  readonly sourceProjectRapId: string | null;
};

export type ProjectActivationReadiness = {
  readonly budgetApproved: boolean;
  readonly rabApproved: boolean;
  readonly rapLocked: boolean;
  readonly isReady: boolean;
};

export function getProjectActivationReadiness({
  projectStatus,
  budgetStatus,
  raps,
  rabEstimates,
}: {
  readonly projectStatus: string;
  readonly budgetStatus: string | null | undefined;
  readonly raps: readonly ActivationRap[];
  readonly rabEstimates: readonly ActivationRab[];
}): ProjectActivationReadiness {
  const approvedRabs = rabEstimates.filter(
    (estimate) =>
      estimate.status === "APPROVED" &&
      estimate.sourceProjectRapId !== null,
  );
  const rabApproved = approvedRabs.length > 0;
  const rapLocked = approvedRabs.some((estimate) =>
    raps.some(
      (rap) =>
        rap.id === estimate.sourceProjectRapId && rap.status === "LOCKED",
    ),
  );
  const budgetApproved = budgetStatus === "APPROVED";

  return {
    budgetApproved,
    rabApproved,
    rapLocked,
    isReady:
      projectStatus === "DRAFT" &&
      budgetApproved &&
      rabApproved &&
      rapLocked,
  };
}
