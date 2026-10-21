import { expect, test } from "bun:test";
import { createInputRequestTools, requestUserInputSchema } from "./input-request-tools";
import { mapConfirmationError } from "@backend/server/usecases/ai/confirm-mutation";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";

test("model-generated project request is persisted without manual cap inputs", async () => {
  const request = createInputRequestTools(aiToolContextForRole("OWNER")).requestUserInput;
  if (request.type !== undefined && request.type !== "function")
    throw new Error("Expected function tool");
  const execute = request.execute;
  if (!execute) throw new Error("Missing executor");
  const output = await execute(
    requestUserInputSchema.parse({
      actionTitle: "Buat proyek baru",
      fields: [
        { key: "projectName", label: "Nama proyek", type: "text" },
        { key: "contractValue", label: "Nilai kontrak", type: "currency" },
        { key: "budgetCapRatio", label: "Plafon budget RAP", type: "number", defaultValue: "0.85" },
      ],
    }),
    { toolCallId: "test", messages: [], context: {} },
  );
  expect(output).toMatchObject({
    status: "INPUT_REQUESTED",
    workflow: "CREATE_PROJECT",
    fields: [{ key: "projectName" }, { key: "contractValue" }],
  });
  expect(JSON.stringify(output)).not.toContain("0.85");
});
test("project wizard checks final capability before collecting explicit or inferred fields", async () => {
  const owner = aiToolContextForRole("OWNER");
  for (const context of [
    { ...owner, permissions: owner.permissions.filter((key) => key !== "create:budget") },
    { ...owner, permissions: owner.permissions.filter((key) => key !== "create:project") },
    { ...owner, dataScope: "ASSIGNED" as const },
  ]) {
    const execute = createInputRequestTools(context).requestUserInput.execute;
    if (!execute) throw new Error("Missing executor");
    for (const workflow of ["CREATE_PROJECT", undefined]) {
      const output = await execute(
        requestUserInputSchema.parse({
          workflow,
          actionTitle: "Buat proyek baru",
          fields: [{ key: "projectName", label: "Nama proyek", type: "text" }],
        }),
        { toolCallId: "test", messages: [], context: {} },
      );
      expect(output).toMatchObject({ toolFailed: true, code: "FORBIDDEN" });
      expect(JSON.stringify(output)).not.toContain("INPUT_REQUESTED");
    }
    const generic = await execute(
      requestUserInputSchema.parse({
        actionTitle: "Koreksi profil",
        fields: [{ key: "name", label: "Nama tampilan", type: "text" }],
      }),
      { toolCallId: "test", messages: [], context: {} },
    );
    expect(generic).toMatchObject({ status: "INPUT_REQUESTED" });
  }
});
test("changed Settings returns actionable recovery instead of an endless retry", () => {
  const result = mapConfirmationError(new Error("PROJECT_BUDGET_DEFAULTS_CHANGED"));
  expect(result).toMatchObject({ success: false, error: { code: "CONFLICT" } });
  if (result.success) throw new Error("Expected conflict");
  expect(result.error.message).toContain("menyiapkan ulang usulan proyek");
});
