import { calculateUsedPercentage, getBudgetCategoryStatus, type ExpenseCategoryCode } from "@/lib/budget/excel-budget";
import {
  projectHealthReasonLabel,
  resolveEffectiveProjectHealth,
  type EffectiveProjectHealth,
  type EffectiveProjectHealthReason,
} from "@/lib/project/effective-health";

export type DashboardRole = "OWNER" | "FINANCE_ADMIN";
export type DashboardSeverity = "CRITICAL" | "WARNING" | "INFO";
export type DashboardPageTab = "overview" | "approvals" | "budget" | "cash" | "accounts" | "materials";
export type DashboardDueBucket = "OVERDUE" | "TODAY" | "NEXT_7_DAYS" | "LATER";
export const DASHBOARD_TAB_DETAIL_LIMIT = 5;
export const DASHBOARD_TIME_ZONE = "Asia/Jakarta";

export type DashboardOpenDocument = {
  readonly amount: number;
  readonly paidAmount: number;
  readonly status: string;
  readonly dueDate: Date;
};

export type DashboardCategoryInput = {
  readonly code: ExpenseCategoryCode;
  readonly name: string;
  readonly allocatedAmount: number;
  readonly pendingAmount: number;
  readonly actualAmount: number;
  readonly paidAmount: number;
  readonly sortOrder: number;
};

export type DashboardProjectInput = {
  readonly projectId: string;
  readonly projectName: string;
  readonly financialHealth: string;
  readonly contractValue: number;
  readonly internalBudget: number;
  readonly targetGrossAmount: number;
  readonly categories: readonly DashboardCategoryInput[];
};

export type FinanceDashboardAction = {
  readonly id: string;
  readonly severity: DashboardSeverity;
  readonly title: string;
  readonly description: string;
  readonly href: string;
};

export type FinanceDashboardCategory = DashboardCategoryInput & {
  readonly remainingAmount: number;
  readonly usedPercentage: number;
  readonly status: "SAFE" | "WATCH" | "CRITICAL" | "OVER_BUDGET";
};

export type FinanceDashboardRiskyProject = {
  readonly projectId: string;
  readonly projectName: string;
  readonly financialHealth: string;
  readonly effectiveHealth: EffectiveProjectHealth;
  readonly healthReasons: readonly EffectiveProjectHealthReason[];
  readonly usedPercentage: number;
  readonly internalBudget: number;
  readonly actualCost: number;
  readonly remainingBudget: number;
  readonly targetMarginPercentage: number;
  readonly projectedMarginPercentage: number;
  readonly riskReason: string;
  readonly riskyCategories: readonly {
    readonly code: ExpenseCategoryCode;
    readonly name: string;
    readonly usedPercentage: number;
    readonly remainingAmount: number;
    readonly status: "SAFE" | "WATCH" | "CRITICAL" | "OVER_BUDGET";
  }[];
};

export type FinanceDashboardOverviewCore = {
  readonly summary: {
    readonly cashAvailable: number;
    readonly receivablesOutstanding: number;
    readonly payablesOutstanding: number;
    readonly payablesDueSoon: number;
    readonly projectValue: number;
    readonly internalBudget: number;
    readonly actualCost: number;
    readonly remainingBudget: number;
    readonly usedPercentage: number;
    readonly projectedMarginAmount: number;
    readonly projectedMarginPercentage: number;
  };
  readonly actions: readonly FinanceDashboardAction[];
  readonly categories: readonly FinanceDashboardCategory[];
  readonly riskyProjects: readonly FinanceDashboardRiskyProject[];
  readonly dashboardTabs: {
    readonly counts: {
      readonly approvals: number;
      readonly budget: number;
      readonly cash: number;
      readonly accounts: number;
      readonly materials: number;
    };
    readonly defaultTab: DashboardPageTab;
    readonly detailLimit: number;
  };
};

export type FinanceDashboardCoreInput = {
  readonly role: DashboardRole;
  readonly cashAvailable: number;
  readonly receivables: readonly DashboardOpenDocument[];
  readonly payables: readonly DashboardOpenDocument[];
  readonly projects: readonly DashboardProjectInput[];
  readonly pendingApprovals: number;
  readonly materialShortageCount: number;
  readonly lowStockCount: number;
  readonly now: Date;
};

export function calculateOutstanding(document: DashboardOpenDocument): number {
  if (document.status === "PAID" || document.status === "VOID") return 0;
  return Math.max(0, document.amount - document.paidAmount);
}

export function limitDashboardTabDetails<T>(items: readonly T[], limit = DASHBOARD_TAB_DETAIL_LIMIT): readonly T[] {
  return items.slice(0, limit);
}

function zonedDayNumber(value: Date, timeZone = DASHBOARD_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function dashboardDueDayOffset(dueDate: Date, referenceDate: Date): number {
  return zonedDayNumber(dueDate) - zonedDayNumber(referenceDate);
}

export function resolveDashboardDueBucket(dueDate: Date, referenceDate: Date): DashboardDueBucket {
  const offset = dashboardDueDayOffset(dueDate, referenceDate);
  if (offset < 0) return "OVERDUE";
  if (offset === 0) return "TODAY";
  if (offset <= 7) return "NEXT_7_DAYS";
  return "LATER";
}

export function resolveDefaultDashboardTab(): DashboardPageTab {
  return "overview";
}

export function buildFinanceDashboardCore(input: FinanceDashboardCoreInput): FinanceDashboardOverviewCore {
  const receivablesOutstanding = input.receivables.reduce((sum, item) => sum + calculateOutstanding(item), 0);
  const payablesOutstanding = input.payables.reduce((sum, item) => sum + calculateOutstanding(item), 0);
  const overdueReceivables = input.receivables.filter(
    (item) =>
      calculateOutstanding(item) > 0 &&
      resolveDashboardDueBucket(item.dueDate, input.now) === "OVERDUE",
  ).length;
  const overduePayables = input.payables.filter(
    (item) =>
      calculateOutstanding(item) > 0 &&
      resolveDashboardDueBucket(item.dueDate, input.now) === "OVERDUE",
  ).length;
  const payablesDueSoon = input.payables.reduce((sum, item) => {
    const bucket = resolveDashboardDueBucket(item.dueDate, input.now);
    return bucket === "LATER" ? sum : sum + calculateOutstanding(item);
  }, 0);

  const projectValue = input.projects.reduce((sum, item) => sum + item.contractValue, 0);
  const internalBudget = input.projects.reduce((sum, item) => sum + item.internalBudget, 0);
  const actualCost = input.projects.reduce(
    (sum, item) => sum + item.categories.reduce((categorySum, category) => categorySum + category.actualAmount, 0),
    0,
  );
  const remainingBudget = internalBudget - actualCost;
  const projectedMarginAmount = projectValue - Math.max(internalBudget, actualCost);

  const categoryMap = new Map<ExpenseCategoryCode, DashboardCategoryInput>();
  for (const project of input.projects) {
    for (const category of project.categories) {
      const current = categoryMap.get(category.code);
      categoryMap.set(category.code, {
        code: category.code,
        name: category.name,
        allocatedAmount: (current?.allocatedAmount ?? 0) + category.allocatedAmount,
        pendingAmount: (current?.pendingAmount ?? 0) + category.pendingAmount,
        actualAmount: (current?.actualAmount ?? 0) + category.actualAmount,
        paidAmount: (current?.paidAmount ?? 0) + category.paidAmount,
        sortOrder: current?.sortOrder ?? category.sortOrder,
      });
    }
  }
  const categories = Array.from(categoryMap.values()).map((category): FinanceDashboardCategory => {
    const usedPercentage = calculateUsedPercentage(category.actualAmount, category.allocatedAmount);
    return {
      ...category,
      remainingAmount: category.allocatedAmount - category.actualAmount,
      usedPercentage,
      status: getBudgetCategoryStatus(usedPercentage),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const allRiskyProjects = input.projects.map((project): FinanceDashboardRiskyProject => {
    const projectActual = project.categories.reduce((sum, category) => sum + category.actualAmount, 0);
    const remaining = project.internalBudget - projectActual;
    const margin = project.contractValue - Math.max(project.internalBudget, projectActual);
    const usedPercentage = calculateUsedPercentage(projectActual, project.internalBudget);
    const projectedMarginPercentage = project.contractValue > 0 ? (margin / project.contractValue) * 100 : 0;
    const targetMarginPercentage = project.contractValue > 0
      ? (project.targetGrossAmount / project.contractValue) * 100
      : 0;
    const riskyCategories = project.categories.map((category) => {
      const categoryUsedPercentage = calculateUsedPercentage(category.actualAmount, category.allocatedAmount);
      return {
        code: category.code,
        name: category.name,
        usedPercentage: categoryUsedPercentage,
        remainingAmount: category.allocatedAmount - category.actualAmount,
        status: getBudgetCategoryStatus(categoryUsedPercentage),
      };
    }).filter((category) => category.status !== "SAFE")
      .sort((a, b) => b.usedPercentage - a.usedPercentage)
      .slice(0, 3);
    const health = resolveEffectiveProjectHealth({
      storedHealth: project.financialHealth,
      remainingBudget: remaining,
      usedPercentage,
      categoryStatuses: project.categories.map((category) =>
        getBudgetCategoryStatus(calculateUsedPercentage(category.actualAmount, category.allocatedAmount)),
      ),
      projectedMarginPercentage,
      targetMarginPercentage,
    });
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      financialHealth: project.financialHealth,
      effectiveHealth: health.effectiveHealth,
      healthReasons: health.healthReasons,
      usedPercentage,
      internalBudget: project.internalBudget,
      actualCost: projectActual,
      remainingBudget: remaining,
      targetMarginPercentage,
      projectedMarginPercentage,
      riskReason: health.healthReasons[0]
        ? projectHealthReasonLabel(health.healthReasons[0])
        : "Perlu review margin dan pemakaian budget.",
      riskyCategories,
    };
  }).filter((project) => project.effectiveHealth !== "HEALTHY")
    .sort((a, b) => {
      const healthRank = (value: string): number => value === "CRITICAL" ? 2 : value === "WARNING" ? 1 : 0;
      return healthRank(b.effectiveHealth) - healthRank(a.effectiveHealth) || b.usedPercentage - a.usedPercentage;
    });
  const riskyProjects = allRiskyProjects.slice(0, DASHBOARD_TAB_DETAIL_LIMIT);

  const actions: Array<FinanceDashboardAction & { readonly priority: number }> = [];
  const addAction = (action: FinanceDashboardAction, ownerPriority: number, financePriority: number): void => {
    actions.push({ ...action, priority: input.role === "OWNER" ? ownerPriority : financePriority });
  };
  if (input.pendingApprovals > 0) {
    addAction({ id: "approvals", severity: "CRITICAL", title: `${input.pendingApprovals} persetujuan menunggu`, description: "Keputusan tertunda dapat menahan pekerjaan atau pembayaran.", href: "/ledger?tab=approvals" }, 10, 30);
  }
  if (riskyProjects.length > 0) {
    const criticalCount = allRiskyProjects.filter((project) => project.effectiveHealth === "CRITICAL").length;
    addAction({ id: "project-risk", severity: criticalCount > 0 ? "CRITICAL" : "WARNING", title: `${allRiskyProjects.length} proyek perlu perhatian`, description: criticalCount > 0 ? `${criticalCount} proyek berisiko menekan margin.` : "Pemakaian budget mendekati batas.", href: "/ledger?tab=budget" }, 20, 40);
  }
  if (overduePayables > 0) {
    addAction({ id: "overdue-payables", severity: "CRITICAL", title: `${overduePayables} tagihan vendor terlambat`, description: "Keterlambatan dapat menghambat suplai dan pekerjaan.", href: "/ledger?tab=cash" }, 31, 10);
  }
  if (overdueReceivables > 0) {
    addAction({ id: "overdue-receivables", severity: "WARNING", title: `${overdueReceivables} invoice klien terlambat`, description: "Kas masuk tertahan sampai invoice ditindaklanjuti.", href: "/ledger?tab=cash" }, 30, 20);
  }
  if (input.materialShortageCount > 0 || input.lowStockCount > 0) {
    addAction({ id: "material-risk", severity: "WARNING", title: `${input.materialShortageCount + input.lowStockCount} masalah material`, description: input.materialShortageCount > 0 ? "Kebutuhan RAP belum tertutup stok tersedia." : "Stok tersedia menyentuh batas minimum.", href: "/ledger?tab=materials" }, 40, 50);
  }
  const priorityCounts = {
    approvals: input.role === "OWNER" ? input.pendingApprovals : 0,
    budget: allRiskyProjects.length,
    cash: input.payables.filter((item) => calculateOutstanding(item) > 0 && resolveDashboardDueBucket(item.dueDate, input.now) !== "LATER").length
      + input.receivables.filter((item) => calculateOutstanding(item) > 0 && resolveDashboardDueBucket(item.dueDate, input.now) !== "LATER").length,
    accounts: 0,
    materials: input.materialShortageCount + input.lowStockCount,
  };

  return {
    summary: {
      cashAvailable: input.cashAvailable,
      receivablesOutstanding,
      payablesOutstanding,
      payablesDueSoon,
      projectValue,
      internalBudget,
      actualCost,
      remainingBudget,
      usedPercentage: calculateUsedPercentage(actualCost, internalBudget),
      projectedMarginAmount,
      projectedMarginPercentage: projectValue > 0 ? (projectedMarginAmount / projectValue) * 100 : 0,
    },
    actions: actions.sort((a, b) => a.priority - b.priority).slice(0, 3).map((action) => ({
      id: action.id,
      severity: action.severity,
      title: action.title,
      description: action.description,
      href: action.href,
    })),
    categories,
    riskyProjects,
    dashboardTabs: {
      counts: priorityCounts,
      defaultTab: resolveDefaultDashboardTab(),
      detailLimit: DASHBOARD_TAB_DETAIL_LIMIT,
    },
  };
}
