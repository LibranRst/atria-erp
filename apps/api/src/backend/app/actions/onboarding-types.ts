export type OnboardingActor = {
  readonly id: string;
  readonly roleId: string;
};

export type OwnerOnboardingBankAccount = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly holderName: string;
  readonly balance: number;
  readonly cardColorFrom: string;
  readonly cardColorTo: string;
  readonly cardTextColor: "light" | "dark";
  readonly isActive: boolean;
  readonly recentTransactions: readonly {
    readonly id: string;
    readonly bankAccountId: string;
    readonly type: string;
    readonly category: string;
    readonly amount: number;
    readonly description: string;
    readonly reconciled: boolean;
    readonly createdAt: Date;
  }[];
  readonly openingBalanceTransaction?: {
    readonly id: string;
    readonly amount: number;
    readonly description: string;
    readonly referenceId: string | null;
  } | null;
};
