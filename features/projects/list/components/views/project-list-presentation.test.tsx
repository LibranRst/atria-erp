import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProjectsLoading from "@/app/projects/loading";
import { ProjectListCard } from "../cards/project-list-card";
import { ProjectListSectionHeader, ProjectSearchAndFilters } from "./project-list-header";

import type { ProjectItem } from "../../types/project-list-types";

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
  test("uses the shared compact count pill for visible project results", () => {
    const html = renderToStaticMarkup(<ProjectListSectionHeader count={12} />);

    expect(html).toContain("Daftar proyek");
    expect(html).toContain('aria-label="12 proyek"');
    expect(html).toContain(">Proyek</span>");
    expect(html).toContain("min-h-8");
    expect(html).toContain("inline-grid h-5 min-w-5");
    expect(html).not.toContain("12 dari");
  });

  test("leads the card with a hero cover carrying identity and status", () => {
    const html = renderToStaticMarkup(
      <ProjectListCard project={project()} isAllowedToCreate onEdit={() => undefined} />,
    );

    expect(html).toContain("aspect-4/3");
    expect(html).toContain(">M</span>");
    expect(html.indexOf(">M</span>")).toBeLessThan(html.indexOf("Aktif"));
    expect(html.indexOf("Aktif")).toBeLessThan(html.indexOf(">Menteng Villa</h2>"));
    expect(html).toContain('aria-label="Buka project Menteng Villa"');
    expect(html).toContain('aria-label="Edit Menteng Villa"');
    expect(html).toContain("Klien Ronald · PM Budi");
    expect(html).toContain("inline-flex min-h-6 items-center");
    expect(html).not.toContain("folder_open");
    expect(html).not.toContain("h-18.5");
    expect(html).not.toContain("Buka project<");
    expect(html).not.toContain("bg-accent/8");
    expect(html).not.toContain("progressbar");
  });

  test("keeps a healthy project free of an attention banner but shows budget usage", () => {
    const html = renderToStaticMarkup(
      <ProjectListCard project={project()} isAllowedToCreate={false} onEdit={() => undefined} />,
    );

    expect(html).toContain("Terkendali");
    expect(html).toContain("Sisa budget");
    expect(html).toContain("text-success");
    expect(html).toContain('role="img"');
    expect(html).not.toContain("Budget masih terkendali");
    expect(html).not.toContain('aria-label="Edit Menteng Villa"');
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
    expect(html).toContain("Melebihi budget");
    expect(html).toContain("text-error");
    expect(html).toContain('role="img"');
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
    expect(html).toContain("aspect-4/3");
    expect(html).not.toContain("h-18.5");
    expect(html).not.toContain("spinner");
  });
});
