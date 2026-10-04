import { describe, expect, test } from "bun:test";

const mutationPath = new URL("./quick-start-mutations.ts", import.meta.url);
const regularProjectPath = new URL("../project/create-project.ts", import.meta.url);
const stockGuardPath = new URL("../../../lib/material/operational-readiness.ts", import.meta.url);

describe("quick-start mutation contracts", () => {
  test("creates the first project, budget, audit, events, and completion inside one transaction", async () => {
    const source = await Bun.file(mutationPath).text();
    expect(source).toContain("db.transaction");
    expect(source).toContain('.for("update")');
    expect(source).toContain("insertProjectWithCanonicalBudgetTx");
    expect(source).toContain("CREATE_FIRST_PROJECT_QUICK_START");
    expect(source).toContain("COMPLETE_OWNER_QUICK_START");
    expect(source).toContain("FIRST_PROJECT_CREATED");
    expect(source).toContain("QUICK_START_COMPLETED");
    expect(source).toContain("alreadyCompleted: true");
  });

  test("keeps the regular project action PM-required", async () => {
    const source = await Bun.file(regularProjectPath).text();
    expect(source).toContain("createProjectSchema.safeParse");
    expect(source).toContain("projectManagerId: data.projectManagerId");
  });

  test("blocks operational stock movement until opening readiness is final", async () => {
    const source = await Bun.file(stockGuardPath).text();
    expect(source).toContain("NO_LEGACY_STOCK");
    expect(source).toContain('inventoryOpeningBatch.status, "POSTED"');
    expect(source).toContain("SETUP_REQUIRED");
  });
});
