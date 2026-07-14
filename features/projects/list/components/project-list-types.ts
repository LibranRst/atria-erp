export interface ClientData {
  readonly id: string;
  readonly name: string;
}

export interface UserData {
  readonly id: string;
  readonly name: string;
}

export type ProjectStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type FinancialHealth = "HEALTHY" | "WARNING" | "CRITICAL";
import type {
  EffectiveProjectHealth,
  EffectiveProjectHealthReason,
} from "@/lib/project/effective-health";
export type FilterId = "ALL" | ProjectStatus | FinancialHealth;

export interface ProjectItem {
  readonly id: string;
  readonly name: string;
  readonly clientId: string;
  readonly projectManagerId: string;
  readonly status: ProjectStatus;
  readonly financialHealth: FinancialHealth;
  readonly effectiveHealth: EffectiveProjectHealth;
  readonly healthReasons: readonly EffectiveProjectHealthReason[];
  readonly totalContractValue: number;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly location?: string | null;
  readonly roomArea?: string | null;
  readonly projectType?: string | null;
  readonly coverImageUrl?: string | null;
  readonly notes?: string | null;
  readonly budgetStatus: string;
  readonly actualCost: number;
  readonly internalBudget: number;
  readonly usedPercentage: number;
  readonly remainingBudget: number;
  readonly clientName: string;
  readonly pmName: string;
}
