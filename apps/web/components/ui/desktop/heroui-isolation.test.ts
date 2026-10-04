import { describe, expect, test } from "bun:test";
import postcss, { type Node } from "postcss";
import { scopeHeroStyles } from "../../../../../scripts/build-heroui-styles";

describe("HeroUI stylesheet isolation", () => {
  test("scopes selector lists through media queries after resolving nesting", () => {
    const scoped = scopeHeroStyles(
      ".button, .input:hover { color: red; &:focus { outline: 0; } } @media (hover:hover) { .table__row { color: blue; } }",
    );
    expect(scoped).toContain("[data-atria-admin] .button");
    expect(scoped).toContain(".input:hover");
    expect(scoped).toContain("[data-atria-admin] .table__row");
    expect(scoped).toContain(":focus");
    expect(scoped).not.toContain("&:focus");
  });

  test("keeps parent-before-& state selectors beneath the admin scope", () => {
    const scoped = scopeHeroStyles(
      '.select__trigger { .select[data-invalid="true"] & { color:red; } }',
    );
    expect(scoped).toContain('[data-atria-admin] .select[data-invalid="true"] .select__trigger');
    expect(scoped).not.toContain('.select[data-invalid="true"] [data-atria-admin]');
  });

  test("rejects document theme selectors instead of silently leaking defaults", () => {
    expect(() => scopeHeroStyles(":root { --accent: blue; }")).toThrow("document theme/reset");
    expect(() => scopeHeroStyles(":host { color: blue; }")).toThrow("document theme/reset");
  });

  test("leaves motion and property registration to Atria", () => {
    const scoped = scopeHeroStyles(
      "@property --radius { syntax:'<length>'; inherits:true; initial-value:0px; } @keyframes spin { to { rotate:360deg; } } .button { animation:spin 1s; transition:all 1s; transform:scale(.97); color:black; }",
    );
    expect(scoped).not.toContain("@property");
    expect(scoped).not.toContain("@keyframes");
    expect(scoped).not.toContain("animation:");
    expect(scoped).not.toContain("transition:");
    expect(scoped).not.toContain("scale(.97)");
  });

  test("generated sheet scopes every outer rule and carries no document resets", async () => {
    const css = await Bun.file(new URL("./heroui-scoped.css", import.meta.url)).text();
    const root = postcss.parse(css);
    root.walkRules((rule): void => {
      let ancestor: Node | undefined = rule.parent;
      while (ancestor && ancestor.type !== "rule") ancestor = ancestor.parent;
      if (!ancestor) expect(rule.selector).toContain("[data-atria-admin]");
    });
    expect(css).not.toContain(":root");
    expect(css).not.toContain(":host");
    expect(css).not.toContain("@theme");
    expect(css).not.toContain("@property");
    expect(css).not.toContain("animation:");
    expect(css).toContain("var(--focus-ring-strong)");
    expect(css).toContain("var(--surface-container-lowest)");
  });

  test("registers canonical layers before component rules even when loaded first", async () => {
    const css = await Bun.file(new URL("./heroui-scoped.css", import.meta.url)).text();
    const root = postcss.parse(css);
    const firstAtRule = root.nodes.find((node): boolean => node.type === "atrule");
    expect(firstAtRule?.type).toBe("atrule");
    if (firstAtRule?.type === "atrule") {
      expect(firstAtRule.name).toBe("layer");
      expect(firstAtRule.params).toBe("properties, theme, base, components, utilities");
    }
    expect(css).toContain("display: inline-flex");
    expect(css).toContain("background-color: var(--button-bg)");
  });

  test("emits finite capsule radii that Chromium can parse", async () => {
    const css = await Bun.file(new URL("./heroui-scoped.css", import.meta.url)).text();
    expect(css).not.toContain("3.40282e38");
    expect(css).not.toContain("infinity");
    const root = postcss.parse(css);
    for (const selector of [
      ".atria-desktop-button",
      ".atria-desktop-input",
      ".atria-desktop-select-trigger",
      ".list-box-item",
    ]) {
      let capsuleFound = false;
      root.walkRules((rule): void => {
        if (rule.selector.includes(selector)) {
          rule.walkDecls("border-radius", (declaration): void => {
            if (declaration.value === "9999px") capsuleFound = true;
          });
        }
      });
      expect(capsuleFound).toBe(true);
    }
  });
});
