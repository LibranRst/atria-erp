import type { ProjectOverviewActionModel } from "../project/project-overview";

export type ProjectOverviewCategory = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly allocatedAmount: number;
  readonly actualAmount: number;
  readonly remainingAmount: number;
  readonly usedPercentage: number;
  readonly status: string;
};

export type ProjectOverviewReadinessId = "rab" | "rap" | "material" | "billing";

export type ProjectOverviewReadinessItem = {
  readonly id: ProjectOverviewReadinessId;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: "APPROVED" | "WARNING" | "CRITICAL" | "DRAFT";
};

export type ProjectOverviewIdentity = {
  readonly id: string;
  readonly name: string;
  readonly status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  readonly effectiveHealth: "HEALTHY" | "WARNING" | "CRITICAL";
  readonly clientName: string;
  readonly pmName: string;
  readonly totalContractValue: number;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly location: string | null;
  readonly roomArea: string | null;
  readonly projectType: string | null;
  readonly coverImageUrl: string | null;
  readonly notes: string | null;
};

/**
 * Bootstrap ringan untuk pintu domain detail proyek. Sengaja tidak membawa RAP
 * item, RAB item, vendor payment, atau movement penuh — itu tanggung jawab
 * layar domain masing-masing (P2.5+).
 */
export type ProjectOverviewData = {
  readonly status: "ready";
  readonly project: ProjectOverviewIdentity;
  readonly isLocked: boolean;
  readonly readiness: readonly ProjectOverviewReadinessItem[];
  readonly actions: readonly ProjectOverviewActionModel[];
  readonly categories: readonly ProjectOverviewCategory[];
};

export type ProjectOverviewPageData =
  ProjectOverviewData | { readonly status: "restricted" } | { readonly status: "notFound" };
