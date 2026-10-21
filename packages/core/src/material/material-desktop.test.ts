import { expect, test } from "bun:test";
import { materialDesktopActivityInputSchema } from "./material-desktop";

test("material activity filters accept stored UUID shapes without discarding another filter", () => {
  const input = {
    kind: "movements",
    projectId: "77777777-7777-7777-7777-777777777771",
    locationId: "14141414-1414-1414-1414-141414141401",
    search: "Menteng",
    status: "USE",
    page: 2,
    pageSize: 25,
  };
  const parsed = materialDesktopActivityInputSchema.parse(input);
  expect(parsed).toMatchObject(input);
  for (const id of [
    "invalid",
    "",
    "77777777777777777777777777777771",
    "gggggggg-7777-7777-7777-777777777771",
  ]) {
    expect(materialDesktopActivityInputSchema.safeParse({ ...input, projectId: id }).success).toBe(
      false,
    );
    expect(materialDesktopActivityInputSchema.safeParse({ ...input, locationId: id }).success).toBe(
      false,
    );
  }
});
