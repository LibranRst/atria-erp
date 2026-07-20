import { describe, expect, test } from "bun:test";

import {
  createProjectFormDraft,
  getProjectDateError,
} from "./project-form-draft";
import { createProjectSchema } from "@/lib/validations/project";

describe("project form draft", () => {
  test("prefills the only active project manager without guessing project values", () => {
    const draft = createProjectFormDraft(null, [{ id: "pm-1" }]);
    expect(draft.projectManagerId).toBe("pm-1");
    expect(draft.status).toBe("DRAFT");
    expect(draft.name).toBe("");
  });

  test("protects the project timeline from an inverted date range", () => {
    expect(getProjectDateError("2026-07-20", "2026-07-19")).toContain("lebih awal");
    expect(getProjectDateError("2026-07-20", "2026-07-20")).toBeNull();
  });

  test("defaults server validation to Draft when no status is supplied", () => {
    const project = createProjectSchema.parse({
      name: "Proyek baru",
      projectManagerId: "pm-1",
    });

    expect(project.status).toBe("DRAFT");
  });
});
