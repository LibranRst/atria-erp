import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  DashboardMaterialIssue,
  DashboardRiskyProject,
} from "@/features/finance-dashboard/lib/dashboard-types";
import { MaterialIssueRow, ProjectRiskRow } from "./dashboard-rows";

const riskyProject: DashboardRiskyProject = {
  projectId: "project-1",
  projectName: "Project Menteng",
  financialHealth: "CRITICAL",
  effectiveHealth: "CRITICAL",
  healthReasons: ["BUDGET_OVERRUN"],
  usedPercentage: 119,
  internalBudget: 720_000_000,
  actualCost: 859_800_000,
  remainingBudget: -139_800_000,
  targetMarginPercentage: 20,
  projectedMarginPercentage: 8,
  riskReason: "Budget project terlampaui",
  riskyCategories: [],
};

const materialIssue: DashboardMaterialIssue = {
  id: "rap-1",
  type: "RAP_SHORTAGE",
  severity: "WARNING",
  materialName: "Multipleks 18mm Meranti",
  projectName: "Project Menteng",
  locationName: null,
  availableStock: 5,
  requiredStock: 34,
  minimumStock: null,
  quantity: 29,
  createdAt: null,
  unit: "lembar",
  description: "Kabinet kitchen membutuhkan 29 lembar tambahan.",
  href: "/projects/project-1?tab=stok",
};

describe("compact Dashboard risk rows", () => {
  test("shows the sourced budget comparison and exact overrun context", () => {
    const html = renderToStaticMarkup(<ProjectRiskRow project={riskyProject} compact />);

    expect(html).toContain("Project Menteng");
    expect(html).toContain("Aktual");
    expect(html).toContain("Internal budget");
    expect(html).toContain("Terpakai 119%");
    expect(html).toContain("Melebihi Rp 139,8 jt");
    expect(html).toContain('href="/projects/project-1?tab=overview"');
  });

  test("shows real available, required, and shortage quantities", () => {
    const html = renderToStaticMarkup(<MaterialIssueRow item={materialIssue} compact />);

    expect(html).toContain("Kurang 29 lembar");
    expect(html).toContain("Tersedia");
    expect(html).toContain("5 lembar");
    expect(html).toContain("Dibutuhkan");
    expect(html).toContain("34 lembar");
    expect(html).toContain('href="/projects/project-1?tab=stok"');
  });
});
