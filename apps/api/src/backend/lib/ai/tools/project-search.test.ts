import { expect, test } from "bun:test";
import { asSchema } from "ai";
import { buildProjectTools } from "./project-tools";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
test("project search accepts trimmed single characters but rejects blank/oversized queries and unbounded results", async () => {
  const schema = asSchema(
    buildProjectTools(aiToolContextForRole("OWNER")).listProjects.inputSchema,
  );
  if (!schema.validate) throw new Error("Runtime validation missing");
  expect((await schema.validate({ query: " X " })).success).toBe(true);
  for (const query of ["", " ", "x".repeat(101)])
    expect((await schema.validate({ query })).success).toBe(false);
  expect((await schema.validate({ query: "X", limit: 21 })).success).toBe(false);
  expect((await schema.validate({ query: "X", limit: 1 })).success).toBe(true);
});
