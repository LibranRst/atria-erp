import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { compile } from "@tailwindcss/node";
import { chromium, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formControlDensityMarkup } from "./form-control-density.fixture";

const markup = {
  desktop: formControlDensityMarkup("desktop"),
  mobile: formControlDensityMarkup("mobile"),
};
const browserInstalled = existsSync(chromium.executablePath());
let browser: Browser;
let stylesheet: string;

beforeAll(async (): Promise<void> => {
  if (!browserInstalled) return;
  const cssPath = new URL("../../../app/globals.css", import.meta.url);
  const compiler = await compile(await Bun.file(cssPath).text(), {
    base: fileURLToPath(new URL("../../../", import.meta.url)),
    onDependency: (): void => undefined,
  });
  const candidates = [...`${markup.desktop}${markup.mobile}`.matchAll(/class="([^"]+)"/g)].flatMap(
    (match): string[] => match[1].split(/\s+/),
  );
  const scoped = await Bun.file(new URL("../desktop/heroui-scoped.css", import.meta.url)).text();
  stylesheet = `${compiler.build(candidates)}\n${scoped}`;
  browser = await chromium.launch();
});

afterAll(async (): Promise<void> => {
  await browser?.close();
});

async function loadFixture(page: Page, presentation: "desktop" | "mobile"): Promise<void> {
  await page.setContent(
    `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${stylesheet}</style></head><body>${markup[presentation]}</body></html>`,
  );
}

async function geometry(page: Page): Promise<Record<string, { height: number; side?: number }>> {
  return page.evaluate((): Record<string, { height: number; side?: number }> => {
    return Object.fromEntries(
      ["date", "grouped-date", "quantity", "grouped-quantity"].map((id) => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing density control: ${id}`);
        const stepper = id.includes("quantity") ? element.parentElement?.parentElement : null;
        const control = stepper ?? element;
        const side = stepper?.querySelector("button")?.getBoundingClientRect().width;
        return [id, { height: control.getBoundingClientRect().height, ...(side ? { side } : {}) }];
      }),
    );
  });
}

describe.skipIf(!browserInstalled)("shared date and quantity contextual density", (): void => {
  test("matches fine-pointer desktop field height at every supported width", async (): Promise<void> => {
    const page = await browser.newPage();
    try {
      for (const width of [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await loadFixture(page, "desktop");
        expect(await geometry(page)).toEqual({
          date: { height: 40 },
          "grouped-date": { height: 32 },
          quantity: { height: 40, side: 40 },
          "grouped-quantity": { height: 32, side: 32 },
        });
      }
    } finally {
      await page.close();
    }
  });

  test("keeps touch desktop fields and stepper actions at 48px", async (): Promise<void> => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage();
      await loadFixture(page, "desktop");
      expect(await geometry(page)).toEqual({
        date: { height: 48 },
        "grouped-date": { height: 48 },
        quantity: { height: 48, side: 48 },
        "grouped-quantity": { height: 48, side: 48 },
      });
    } finally {
      await context.close();
    }
  });

  test("preserves incumbent mobile and native-pinned geometry", async (): Promise<void> => {
    const page = await browser.newPage();
    try {
      for (const width of [320, 360, 390, 430, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await loadFixture(page, "mobile");
        expect(await geometry(page)).toEqual({
          date: { height: 48 },
          "grouped-date": { height: 48 },
          quantity: { height: 48, side: 44 },
          "grouped-quantity": { height: 40, side: 44 },
        });
        expect(
          await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
    } finally {
      await page.close();
    }
  });
});
