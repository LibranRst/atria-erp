import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CountBadge, getStatusPresentation, resolveStatusPresentation, StatusBadge } from "../badge/badge";
import { AppIcon } from "../icon/app-icon";
import { Button, IconButton } from "../button/button";
import { SheetFooterActions } from "../overlay/sheet-footer-actions";

describe("Atria control language", () => {
  test("keeps primary and irreversible actions visually distinct and pending-safe", () => {
    const primary = renderToStaticMarkup(<Button pending>Catat</Button>);
    const critical = renderToStaticMarkup(<Button variant="critical">Hapus permanen</Button>);

    expect(primary).toContain("bg-primary");
    expect(primary).toContain("Memproses…");
    expect(primary).toContain("disabled");
    expect(critical).toContain("bg-critical");
    expect(critical).toContain("min-h-12");
  });

  test("requires an accessible icon label and keeps status badges semantically marked", () => {
    const icon = renderToStaticMarkup(<IconButton label="Tutup" icon={<span>×</span>} />);
    const warning = renderToStaticMarkup(<StatusBadge tone="warning" label="Perlu ditinjau" />);
    const completed = renderToStaticMarkup(<StatusBadge tone="completed" label="Selesai" />);

    expect(icon).toContain('aria-label="Tutup"');
    expect(warning).toContain("h-1.5 w-1.5");
    expect(completed).not.toContain("h-1.5 w-1.5");
    expect(getStatusPresentation("OVER_BUDGET")).toEqual({
      label: "Melebihi budget",
      tone: "critical",
    });
    expect(resolveStatusPresentation("UNMAPPED_LEGACY_STATUS")).toEqual({
      label: "Unmapped legacy status",
      tone: "neutral",
    });
  });

  test("maps active Dashboard risk icons without the fallback glyph", () => {
    const projectRisk = renderToStaticMarkup(<AppIcon name="analytics" />);
    const fallback = renderToStaticMarkup(<AppIcon name="unknown-icon" />);

    expect(projectRisk).not.toBe(fallback);
  });

  test("separates actionable counts and sheet primary actions from status badges", () => {
    const count = renderToStaticMarkup(<CountBadge count={120} label="tagihan perlu ditinjau" />);
    const footer = renderToStaticMarkup(
      <SheetFooterActions
        secondary={{ label: "Ubah", onClick: () => undefined }}
        primary={{ label: "Simpan", onClick: () => undefined }}
      />,
    );

    expect(count).toContain('aria-label="120 tagihan perlu ditinjau"');
    expect(count).toContain("99+");
    expect(footer).toContain("grid grid-cols-2 gap-2");
    expect(footer.indexOf(">Ubah<")).toBeLessThan(footer.indexOf(">Simpan<"));
    expect(footer).toContain("min-w-0");
  });
});

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (entry === "node_modules" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.(?:ts|tsx|css)$/.test(entry) ? [path] : [];
  });
}

test("UI source does not reintroduce raw semantic palette values", () => {
  const root = process.cwd();
  const allowed = new Set([
    "app/globals.css",
    "features/finance-dashboard/components/bank-accounts/constants.ts",
  ]);
  const rawSemanticColor =
    /#007AFF|(?:bg|text|border|ring|fill|stroke|caret)-(?:blue|emerald|amber|orange|green|red|slate)-\d{2,3}/;
  const files = ["app", "components", "features"].flatMap((directory) =>
    collectSourceFiles(join(root, directory)),
  );
  const violations = files
    .map((path) => relative(root, path))
    .filter((path) => !allowed.has(path))
    .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"))
    .filter((path) => rawSemanticColor.test(readFileSync(join(root, path), "utf8")));

  expect(violations).toEqual([]);
});

test("UI source does not reintroduce Material Symbols or icon fonts", () => {
  const root = process.cwd();
  const materialSymbolReference = /material-symbols|material-icons|Material\+Symbols/;
  const files = ["app", "components", "features", "lib"].flatMap((directory) =>
    collectSourceFiles(join(root, directory)),
  );
  const violations = files
    .map((path) => relative(root, path))
    .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"))
    .filter((path) => materialSymbolReference.test(readFileSync(join(root, path), "utf8")));

  expect(violations).toEqual([]);
});
