import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectList } from "./project-list";
import { BudgetSummary } from "./budget-summary";
import { projectBudgetFixture, projectFormFixture, projectListFixture } from "../fixtures/projects";
import { mock } from "bun:test";

const navigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...navigation,
  useRouter: () => ({ refresh: () => undefined }),
}));

describe("Native HeroUI project presentation", () => {
  test("a viewer gets a real table with links and no create action", () => {
    if (projectListFixture.status !== "ready") throw new Error("Invalid fixture");
    const html = renderToStaticMarkup(
      <ProjectList
        projects={projectListFixture.projects}
        formOptions={null}
        permissions={{
          canCreate: false,
          canEdit: false,
          canCreateBudget: false,
          canApproveBudget: false,
        }}
      />,
    );
    expect(html).toContain('role="grid"');
    expect(html).toContain("table__sortable-column-header");
    expect(html).toContain(`/projects/${projectBudgetFixture.projectId}`);
    expect(html).not.toContain("Buat proyek</");
    expect(html).toContain('aria-label="Daftar proyek dan penggunaan budget"');
    expect(html).toContain('type="search"');
  });
  test("create permission exposes a compact HeroUI button without inheriting mobile sizing", () => {
    if (projectListFixture.status !== "ready") throw new Error("Invalid fixture");
    const html = renderToStaticMarkup(
      <ProjectList
        projects={[]}
        formOptions={projectFormFixture}
        permissions={{
          canCreate: true,
          canEdit: true,
          canCreateBudget: true,
          canApproveBudget: true,
        }}
      />,
    );
    expect(html).toContain("Buat proyek");
    expect(html).toContain("button--sm");
    expect(html).not.toContain("min-h-12");
    expect(html).toContain("Belum ada proyek");
  });
  test("budget summary displays authoritative paid and consumed values separately", () => {
    const html = renderToStaticMarkup(<BudgetSummary budget={projectBudgetFixture} />);
    expect(html).toContain("Dibayar");
    expect(html).toContain("Terpakai");
    expect(html).toContain("Rp 75 jt");
    expect(html).toContain("Rp 94 jt");
    expect(html).toContain("Penggunaan kategori");
    expect(html).not.toContain("PENDING_APPROVAL");
    expect(html).toContain("Lain-lain");
  });
});
