import type { ProjectOperationSource } from "./project-operations";

/** FINAL totals stored when the project is closed; categories and cash breakdown are not frozen. */
export interface ProjectMarginFinalSnapshot {
  readonly id: string;
  readonly snapshotAt: Date;
  readonly contractValue: string;
  readonly internalBudget: string;
  readonly actualCost: string;
  readonly remainingBudget: string;
  readonly targetGrossAmount: string;
  readonly targetGrossPercentage: string;
  readonly realizedMarginAmount: string;
  readonly realizedMarginPercentage: string;
  readonly cashPosition: string;
}

export interface ProjectMarginCash {
  readonly received: number;
  readonly paid: number;
  readonly position: number;
}

/** Source failures and restricted reads must not be rendered as healthy zero totals. */
export interface ProjectMarginData {
  readonly source: ProjectOperationSource;
  readonly cashSource: ProjectOperationSource;
  readonly finalSnapshotSource: ProjectOperationSource;
  readonly cash: ProjectMarginCash | null;
  readonly finalSnapshot: ProjectMarginFinalSnapshot | null;
}
