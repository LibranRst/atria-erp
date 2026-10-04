import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compile, optimize } from "@tailwindcss/node";
import postcss, { type AtRule, type Declaration, type Node, type Rule } from "postcss";
import selectorParser from "postcss-selector-parser";

const scope = "[data-atria-admin]";
const sourcePath = fileURLToPath(
  new URL("../apps/web/components/ui/desktop/heroui-source.css", import.meta.url),
);
const outputPath = fileURLToPath(
  new URL("../apps/web/components/ui/desktop/heroui-scoped.css", import.meta.url),
);

function hasRuleAncestor(rule: Rule): boolean {
  let ancestor: Node | undefined = rule.parent;
  while (ancestor) {
    if (ancestor.type === "rule") return true;
    ancestor = ancestor.parent;
  }
  return false;
}

/** Resolve nesting before prefixing: ancestor selectors must stay inside the scope. */
export function scopeHeroStyles(css: string): string {
  const root = postcss.parse(optimize(css).code);
  root.walkAtRules((atRule: AtRule): void => {
    // The main app already owns Tailwind registrations. Hero CSS has no motion owner.
    if (atRule.name === "property" || atRule.name === "keyframes") atRule.remove();
  });
  root.walkDecls((declaration: Declaration): void => {
    // LightningCSS can encode Tailwind's infinite pill radius as a float Chromium
    // clamps to zero. Every capsule in this scoped entry uses a finite radius.
    if (declaration.prop.includes("radius") && /infinity|3\.40282e\+?38/i.test(declaration.value))
      declaration.value = "9999px";
    if (declaration.prop.startsWith("animation") || declaration.prop.startsWith("transition")) {
      declaration.remove();
    }
    if (declaration.prop === "transform" && declaration.value.startsWith("scale(")) {
      declaration.remove();
    }
  });
  root.walkRules((rule: Rule): void => {
    if (hasRuleAncestor(rule)) return;
    rule.selector = selectorParser((selectors: selectorParser.Root): void => {
      selectors.each((selector: selectorParser.Selector): void => {
        if (selector.toString() === scope) return;
        selector.walkPseudos((pseudo: selectorParser.Pseudo): void => {
          if (pseudo.value === ":root" || pseudo.value === ":host") {
            throw new Error("HeroUI entry must not emit document theme/reset selectors");
          }
        });
        selector.prepend(selectorParser.combinator({ value: " " }));
        selector.prepend(
          selectorParser.attribute({ attribute: "data-atria-admin", raws: {}, value: undefined }),
        );
      });
    }).processSync(rule.selector);
  });
  // Next may load this chunk before globals.css. Register every existing layer in
  // canonical order so preflight can never outrank the HeroUI component styles.
  return `/* Generated from HeroUI 3.2.6 + Atria tokens. Run bun run heroui:styles. */\n@layer properties, theme, base, components, utilities;\n${root.toString().trim()}\n`;
}

export async function buildHeroStyles(): Promise<string> {
  const source = await readFile(sourcePath, "utf8");
  const compiler = await compile(source, {
    base: path.dirname(sourcePath),
    onDependency: (): void => undefined,
  });
  return scopeHeroStyles(compiler.build([]));
}

if (import.meta.main) {
  const css = await buildHeroStyles();
  if (process.argv.includes("--check")) {
    const current = await readFile(outputPath, "utf8");
    if (current !== css)
      throw new Error("Scoped HeroUI styles are stale. Run bun run heroui:styles.");
  } else {
    await writeFile(outputPath, css);
  }
}
