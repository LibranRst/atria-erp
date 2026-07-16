import { describe, expect, test } from "bun:test";

import type { ProjectItem } from "./project-list-types";
import { matchesFilter, summarizeProjectPortfolio } from "./project-list-utils";

function project(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: "project-1",
    name: "Proyek Satu",
    clientId: "client-1",
    projectManagerId: "user-1",
    status: "ACTIVE",
    financialHealth: "HEALTHY",
    effectiveHealth: "CRITICAL",
    healthReasons: ["BUDGET_OVERRUN"],
    totalContractValue: 100,
    budgetStatus: "APPROVED",
    actualCost: 120,
    internalBudget: 100,
    usedPercentage: 120,
    remainingBudget: -20,
    clientName: "Klien",
    pmName: "PM",
    ...overrides,
  };
}

describe("project list filters", () => {
  test("filters financial risk from effective rather than stored health", () => {
    expect(matchesFilter(project(), "CRITICAL")).toBe(true);
    expect(matchesFilter(project(), "WARNING")).toBe(false);
  });

  test("keeps lifecycle filters independent from financial health", () => {
    expect(matchesFilter(project(), "ACTIVE")).toBe(true);
    expect(matchesFilter(project(), "COMPLETED")).toBe(false);
  });

  test("summarizes only active project finances and actionable operational risk", () => {
    const summary = summarizeProjectPortfolio([
      project({
        id: "active-risk",
        totalContractValue: 1_000,
        internalBudget: 800,
        actualCost: 500,
        remainingBudget: 300,
        effectiveHealth: "WARNING",
      }),
      project({
        id: "completed-risk",
        status: "COMPLETED",
        totalContractValue: 2_000,
        internalBudget: 1_600,
        actualCost: 1_700,
        remainingBudget: -100,
      }),
      project({
        id: "draft-healthy",
        status: "DRAFT",
        effectiveHealth: "HEALTHY",
        totalContractValue: 900,
      }),
    ]);

    expect(summary).toEqual({
      activeCount: 1,
      attentionCount: 1,
      activeContractValue: 1_000,
      activeInternalBudget: 800,
      activeActualCost: 500,
      activeRemainingBudget: 300,
    });
  });
});
