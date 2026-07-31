import { describe, expect, test } from "bun:test";

const projectTabsPath = new URL("./project-tabs.tsx", import.meta.url);

describe("project tab position contract", () => {
  test("restores the reading position without animated document scrolling", async () => {
    const source = await Bun.file(projectTabsPath).text();

    expect(source).toContain('behavior: "auto"');
    expect(source).not.toContain('behavior: "smooth"');
  });
});
