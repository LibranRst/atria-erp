import { describe, expect, test } from "bun:test";
import {
  PROJECTS_FIXTURE_PROJECTS,
  projectsFixtureBudget,
  projectsFixtureData,
  projectsFixtureId,
} from "./projects-data.fixture";

describe("safe Project visual fixtures", () => {
  test("exercises multiple pages, every lifecycle, missing setup and legitimate zero", () => {
    expect(PROJECTS_FIXTURE_PROJECTS.length).toBeGreaterThan(25);
    expect(new Set(PROJECTS_FIXTURE_PROJECTS.map((project) => project.status))).toEqual(
      new Set(["ACTIVE", "DRAFT", "ON_HOLD", "COMPLETED", "CANCELLED"]),
    );
    expect(PROJECTS_FIXTURE_PROJECTS.some((project) => project.budgetId === null)).toBe(true);
    expect(
      PROJECTS_FIXTURE_PROJECTS.some(
        (project) =>
          project.budgetId && project.budgetStatus === "APPROVED" && project.internalBudget === 0,
      ),
    ).toBe(true);
    expect(PROJECTS_FIXTURE_PROJECTS.some((project) => project.remainingBudget < 0)).toBe(true);
    expect(PROJECTS_FIXTURE_PROJECTS.some((project) => !Number.isInteger(project.actualCost))).toBe(
      true,
    );
  });
  test("assigned scope supplies only the fixture PM's projects and no create affordance", () => {
    const data = projectsFixtureData("assigned");
    expect(data.projects.length).toBeGreaterThan(0);
    expect(
      data.projects.every((project) => project.projectManagerId === projectsFixtureId(201)),
    ).toBe(true);
    expect(data.isAllowedToCreate).toBe(false);
    expect(projectsFixtureData("empty").projects).toHaveLength(0);
  });
  test("budget fixture keeps five categories, payment and review separate, and cents exact", () => {
    for (const kind of ["approved", "draft", "pending", "zero", "risk"] as const) {
      const budget = projectsFixtureBudget(kind);
      expect(budget.categories).toHaveLength(5);
      expect(budget.actualCost).toBe(
        budget.categories.reduce((sum, category) => sum + category.actualAmount, 0),
      );
      expect(budget.paidCost).toBe(
        budget.categories.reduce((sum, category) => sum + category.paidAmount, 0),
      );
      expect(budget.pendingCost).toBe(
        budget.categories.reduce((sum, category) => sum + category.pendingAmount, 0),
      );
      expect(budget.remainingBudget).toBe(budget.internalBudget - budget.actualCost);
    }
    expect(projectsFixtureBudget("approved").categories[0]?.actualAmount).toBe(43_500_000.25);
    expect(projectsFixtureBudget("risk").remainingBudget).toBeLessThan(0);
    expect(projectsFixtureBudget("zero").internalBudget).toBe(0);
  });
});
