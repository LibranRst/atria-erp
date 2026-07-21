import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProjectsLoading from "@/app/projects/loading";
import { ProjectListCard } from "./project-list-card";
import { ProjectSearchAndFilters } from "./project-list-header";
import type { ProjectItem } from "./project-list-types";

function project(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: "project-1",
    name: "Menteng Villa",
    clientId: "client-1",
    projectManagerId: "pm-1",
    status: "ACTIVE",
    financialHealth: "HEALTHY",
    effectiveHealth: "HEALTHY",
    healthReasons: [],
    totalContractValue: 1_000_000_000,
    location: "Jakarta",
    coverImageUrl: null,
    budgetStatus: "APPROVED",
    actualCost: 500_000_000,
    internalBudget: 800_000_000,
    usedPercentage: 62.5,
    remainingBudget: 300_000_000,
    clientName: "Ronald",
    pmName: "Budi",
    ...overrides,
  };
}

describe("project list presentation", () => {
  test("uses a compact independent project card", () => {
    const html = renderToStaticMarkup(
      <ProjectListCard project={project()} isAllowedToCreate onEdit={() => undefined} />,
    );

    expect(html).toContain("h-[74px]");
    expect(html).toContain(">M</span>");
    expect(html.indexOf("Aktif")).toBeLessThan(html.indexOf(">M</span>"));
    expect(html.indexOf(">M</span>")).toBeLessThan(html.indexOf(">Menteng Villa</h2>"));
    expect(html).toContain("flex min-h-10 min-w-0 pr-11");
    expect(html).toContain("inline-flex h-6 shrink-0 items-center");
    expect(html).toContain("bg-surface-container-low/70");
    expect(html).not.toContain("bg-success/8");
    expect(html).not.toContain("folder_open");
    expect(html).toContain("Budget masih terkendali");
    expect(html).toContain("Buka project");
    expect(html).toContain("bg-[#007AFF]/8");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("h-40");
    expect(html).not.toContain("progressbar");
  });

  test("uses the portfolio-style budget split when budget risk is actionable", () => {
    const html = renderToStaticMarkup(
      <ProjectListCard
        project={project({
          effectiveHealth: "CRITICAL",
          healthReasons: ["BUDGET_OVERRUN"],
          usedPercentage: 118,
          remainingBudget: -144_000_000,
        })}
        isAllowedToCreate={false}
        onEdit={() => undefined}
      />,
    );

    expect(html).toContain("Budget proyek terlampaui");
    expect(html).toContain("Budget terpakai 118.0 persen, melebihi batas 18.0 persen");
    expect(html).toContain("Lebih 18%");
    expect(html).not.toContain("Batas perhatian 80 persen");
  });

  test("keeps the search surface in the inline document flow", () => {
    const html = renderToStaticMarkup(
      <ProjectSearchAndFilters
        activeFilter="ALL"
        filterCounts={{ CRITICAL: 1 }}
        mode="filter"
        searchQuery=""
        onFilterChange={() => undefined}
        onModeChange={() => undefined}
        onSearchChange={() => undefined}
      />,
    );

    expect(html).toContain('data-sticky="false"');
    expect(html).toContain('data-density="inline"');
    expect(html).toContain('data-control-mode="filter"');
    expect(html).toContain('aria-label="Buka cari proyek"');
    expect(html).toContain("bg-white/96");
    expect(html).not.toContain("sticky-search-surface");
    expect(html).not.toContain('class="h-px"');
  });

  test("uses a route-specific structural loading state", () => {
    const html = renderToStaticMarkup(<ProjectsLoading />);

    expect(html).toContain("Memuat Proyek");
    expect(html).toContain("Portfolio dan daftar proyek sedang disiapkan");
    expect(html).toContain("h-[74px]");
    expect(html).not.toContain("spinner");
  });
});
