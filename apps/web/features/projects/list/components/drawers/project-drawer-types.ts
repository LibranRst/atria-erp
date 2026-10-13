export type ProjectClientOption = {
  readonly id: string;
  readonly name: string;
};

export type ProjectUserOption = {
  readonly id: string;
  readonly name: string;
};

export type ProjectDrawerData = {
  readonly id: string;
  readonly name: string;
  readonly clientId: string;
  readonly projectManagerId: string | null;
  readonly status: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  readonly financialHealth: "HEALTHY" | "WARNING" | "CRITICAL";
  readonly totalContractValue: number;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly location?: string | null;
  readonly roomArea?: string | null;
  readonly projectType?: string | null;
  readonly coverImageUrl?: string | null;
  readonly notes?: string | null;
};

export type ProjectDrawerProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly clients: readonly ProjectClientOption[];
  readonly users: readonly ProjectUserOption[];
  readonly editProject?: ProjectDrawerData | null;
};
