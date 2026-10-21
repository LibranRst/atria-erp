import { expect, test } from "bun:test";
import { asSchema } from "ai";
import { buildAiTools } from "./index";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";

function emptyEnumPaths(value: unknown, path: string): string[] {
  if (typeof value !== "object" || value === null) return [];
  if (Array.isArray(value))
    return value.flatMap((child, i) => emptyEnumPaths(child, `${path}[${i}]`));
  const found: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === "const" && child === "") found.push(`${path}.const`);
    if (key === "enum" && Array.isArray(child) && child.includes("")) found.push(`${path}.enum`);
    found.push(...emptyEnumPaths(child, `${path}.${key}`));
  }
  return found;
}
test("the complete model-facing tool catalog contains no empty enum rejected by Gemini gateways", async () => {
  const violations: string[] = [];
  for (const [name, definition] of Object.entries(buildAiTools(aiToolContextForRole("OWNER")))) {
    const schema = await asSchema(definition.inputSchema).jsonSchema;
    violations.push(...emptyEnumPaths(schema, name));
  }
  expect(violations).toEqual([]);
});
