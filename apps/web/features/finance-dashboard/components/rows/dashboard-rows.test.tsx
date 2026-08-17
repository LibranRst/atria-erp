import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  DashboardCategory,
  DashboardMaterialIssue,
  DashboardRiskyProject,
} from "@/features/finance-dashboard/types/dashboard-types";
import { CategoryUsageRow } from "./category-rows";
import { ProjectRiskRow } from "./project-rows";
import { MaterialIssueRow } from "./material-rows";

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

const categoryUsage: DashboardCategory = {
  code: "MATERIAL",
  name: "Material",
  allocatedAmount: 800_000_000,
  pendingAmount: 25_000_000,
  actualAmount: 680_000_000,
  paidAmount: 640_000_000,
  sortOrder: 1,
  remainingAmount: 120_000_000,
  usedPercentage: 85,
  status: "WATCH",
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
    expect(html).not.toContain("h-7 w-1");
  });

  test("shows real available, required, and shortage quantities", () => {
    const html = renderToStaticMarkup(<MaterialIssueRow item={materialIssue} compact />);

    expect(html).toContain("Kurang 29 lembar");
    expect(html).toContain("Tersedia");
    expect(html).toContain("5 lembar");
    expect(html).toContain("Dibutuhkan");
    expect(html).toContain("34 lembar");
    expect(html).toContain('href="/projects/project-1?tab=stok"');
    expect(html).not.toContain("h-7 w-1");
  });

  test("pairs category progress with used and remaining nominal context", () => {
    const html = renderToStaticMarkup(<CategoryUsageRow category={categoryUsage} />);

    expect(html).toContain("Material");
    expect(html).toContain("Alokasi Rp 800 jt");
    expect(html).toContain("Terpakai Rp 680 jt");
    expect(html).toContain("Tersisa 15% · Rp 120 jt");
    expect(html).toContain("rounded-icon");
    expect(html).not.toContain("h-7 w-1");
  });
});
