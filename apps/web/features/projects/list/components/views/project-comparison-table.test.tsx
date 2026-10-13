import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import type { ProjectItem } from "../../types/project-list-types";
import { ProjectComparisonTable } from "./project-comparison-table";

function project(id: string, value: number, status: ProjectItem["status"] = "ACTIVE"): ProjectItem {
  return {
    id,
    name: `Proyek ${id}`,
    clientId: "client",
    projectManagerId: "pm",
    status,
    financialHealth: "HEALTHY",
    effectiveHealth: "HEALTHY",
    healthReasons: [],
    totalContractValue: value,
    budgetStatus: "APPROVED",
    actualCost: 40_000_000,
    internalBudget: 140_000_000,
    usedPercentage: 28.6,
    remainingBudget: 100_000_000,
    clientName: "Klien",
    pmName: "PM",
  };
}

describe("responsive project comparison contract", () => {
  test("uses controlled numeric sorting and keeps the selected project independent of row order", () => {
    const html = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <ProjectComparisonTable
          projects={[project("A", 20_000_000), project("B", 200_000_000)]}
          selectedProjectId="A"
          sort={{ column: "value", direction: "descending" }}
          canEdit
          onSelect={() => undefined}
          onSort={() => undefined}
          onEdit={() => undefined}
        />
      </WorkspacePresentationProvider>,
    );
    expect(html).toContain('role="grid"');
    expect(html).toContain('aria-sort="descending"');
    expect(html.indexOf("Proyek B")).toBeLessThan(html.indexOf("Proyek A"));
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Tutup ringkasan proyek");
    expect(html).toContain("button--sm");
    expect(html).toContain('href="/projects/A"');
    expect(html).not.toContain('href="/admin/projects/A"');
  });
  test("viewers and terminal projects have no edit affordance", () => {
    function html(canEdit: boolean, status: ProjectItem["status"]): string {
      return renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <ProjectComparisonTable
            projects={[project("A", 200_000_000, status)]}
            selectedProjectId={null}
            sort={{ column: "project", direction: "ascending" }}
            canEdit={canEdit}
            onSelect={() => undefined}
            onSort={() => undefined}
            onEdit={() => undefined}
          />
        </WorkspacePresentationProvider>,
      );
    }
    expect(html(false, "ACTIVE")).not.toContain(">Edit</span>");
    expect(html(true, "COMPLETED")).not.toContain(">Edit</span>");
    expect(html(true, "CANCELLED")).not.toContain(">Edit</span>");
    expect(html(true, "ACTIVE")).toContain(">Edit</span>");
  });
});
