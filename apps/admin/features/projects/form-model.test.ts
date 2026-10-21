import { describe, expect, test } from "bun:test";
import {
  createProjectInput,
  projectDraft,
  updateProjectInput,
  validateProjectDraft,
  type ProjectDraft,
} from "./form-model";
import { projectListFixture } from "./fixtures/projects";

describe("Project form contract", () => {
  test("new projects remain drafts even when a client changes presentation state", () => {
    const draft: ProjectDraft = {
      ...projectDraft(null),
      name: "  Kantor baru  ",
      newClientName: "Klien baru",
      projectManagerId: "pm",
      status: "ACTIVE",
    };
    expect(validateProjectDraft(draft, false)).toBeNull();
    expect(createProjectInput(draft).status).toBe("DRAFT");
    expect(createProjectInput(draft).name).toBe("Kantor baru");
  });
  test("editing requires an existing client and preserves status/financial health", () => {
    if (projectListFixture.status !== "ready") throw new Error("Invalid fixture");
    const project = projectListFixture.projects[0];
    const draft = projectDraft(project);
    expect(validateProjectDraft({ ...draft, clientId: "", newClientName: "New" }, true)).toContain(
      "klien",
    );
    expect(updateProjectInput(project.id, draft)).toMatchObject({
      id: project.id,
      status: project.status,
      financialHealth: project.financialHealth,
      totalContractValue: project.totalContractValue,
    });
  });
  test("rejects reversed dates and invalid monetary input before review", () => {
    const draft = {
      ...projectDraft(null),
      name: "Proyek",
      clientId: "client",
      projectManagerId: "pm",
      startDate: "2026-10-08",
      endDate: "2026-10-06",
    };
    expect(validateProjectDraft(draft, false)).toContain("Tanggal selesai");
    expect(validateProjectDraft({ ...draft, totalContractValue: Number.NaN }, false)).toContain(
      "nominal",
    );
    expect(validateProjectDraft({ ...draft, totalContractValue: -1 }, false)).toContain("nominal");
  });
});
