import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { compile } from "@tailwindcss/node";
import { chromium, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatComposer } from "@/features/ai-chat/components/chat-composer";
import {
  FormField,
  MoneyInput,
  NumericInput,
  QuantityStepper,
  Textarea,
  TextInput,
} from "./basic-form-controls";
import { CustomColorPicker } from "./color-picker";
import { FormSection } from "./guided-form";
import { SearchInput } from "./select-form-controls";

const unchanged = (): void => undefined;
const markup = renderToStaticMarkup(
  <main className="mx-auto w-full max-w-md px-5">
    <TextInput id="standalone" value="Atria" onChange={unchanged} />
    <FormSection>
      <FormField label="Email">
        <TextInput id="email" type="email" value="" onChange={unchanged} />
      </FormField>
      <FormField label="Kata sandi">
        <TextInput id="password" type="password" value="" onChange={unchanged} />
      </FormField>
      <FormField label="Nominal">
        <MoneyInput id="money" value="123456789" onChange={unchanged} />
      </FormField>
      <FormField label="Persentase">
        <NumericInput id="numeric" value="10" onChange={unchanged} />
      </FormField>
      <FormField label="Jumlah">
        <QuantityStepper id="quantity" value="2" onChange={unchanged} />
      </FormField>
      <FormField label="Catatan">
        <Textarea id="grouped-notes" value="" onChange={unchanged} />
      </FormField>
    </FormSection>
    <Textarea id="standalone-notes" value="" onChange={unchanged} />
    <SearchInput id="search" value="" onChange={unchanged} />
    <CustomColorPicker id="hex" value="#181817" onChange={unchanged} presets={[]} />
    <ChatComposer
      value=""
      onChange={unchanged}
      onSubmit={unchanged}
      onStop={unchanged}
      isBusy={false}
    />
    <input id="larger" className="text-section" aria-label="Larger text" />
    <input id="inherited" aria-label="Unstyled text" />
    <input id="readonly" className="text-sm" readOnly aria-label="Read only" />
    <input id="file" type="file" className="text-sm" aria-label="Upload" />
    <input id="checkbox" type="checkbox" className="text-sm" aria-label="Choice" />
    <p id="support" className="text-support">
      Konfirmasi sebelum menyimpan.
    </p>
  </main>,
);
const editableIds = [
  "standalone",
  "email",
  "password",
  "money",
  "numeric",
  "quantity",
  "grouped-notes",
  "standalone-notes",
  "search",
  "hex",
  "ai-chat-input",
  "inherited",
];

let browser: Browser;
let stylesheet: string;
// Plain Bun unit runs do not install a browser; execute this regression when
// the existing Playwright Chromium binary is available, without downloading it.
const browserInstalled = existsSync(chromium.executablePath());

beforeAll(async (): Promise<void> => {
  if (!browserInstalled) return;
  const cssPath = new URL("../../../app/globals.css", import.meta.url);
  const compiler = await compile(await Bun.file(cssPath).text(), {
    base: fileURLToPath(new URL("../../../", import.meta.url)),
    onDependency: unchanged,
  });
  const candidates = [...markup.matchAll(/class="([^"]+)"/g)].flatMap((match): string[] =>
    match[1].split(/\s+/),
  );
  stylesheet = compiler.build(candidates);
  browser = await chromium.launch();
});

afterAll(async (): Promise<void> => {
  await browser?.close();
});

async function loadFixture(page: Page): Promise<void> {
  await page.setContent(
    `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${stylesheet}</style></head><body>${markup}</body></html>`,
  );
}

async function fontSizes(page: Page, ids: readonly string[]): Promise<Record<string, number>> {
  return page.evaluate((controlIds): Record<string, number> => {
    return Object.fromEntries(
      controlIds.map((id): [string, number] => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing typography fixture: ${id}`);
        return [id, Number.parseFloat(getComputedStyle(element).fontSize)];
      }),
    );
  }, ids);
}

async function expectComposerMeasurementTypography(page: Page): Promise<void> {
  const fonts = await page.evaluate((): { control: string; mirror: string } => {
    const control = document.getElementById("ai-chat-input");
    const mirror = document.querySelector("[data-composer-mirror]");
    if (!control || !mirror) throw new Error("Missing composer measurement elements");
    return { control: getComputedStyle(control).font, mirror: getComputedStyle(mirror).font };
  });
  expect(fonts.mirror).toBe(fonts.control);
}

describe.skipIf(!browserInstalled)(
  "editable input typography in the compiled production stylesheet",
  (): void => {
    test("keeps shared form, search, HEX and chat text at least 16px at every mobile width", async (): Promise<void> => {
      const page = await browser.newPage();
      try {
        for (const width of [320, 360, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          await loadFixture(page);
          const sizes = await fontSizes(page, editableIds);
          await expectComposerMeasurementTypography(page);
          for (const [id, size] of Object.entries(sizes)) {
            expect({ width, id, size }).toEqual({ width, id, size: 16 });
          }
          expect(
            await fontSizes(page, ["larger", "support", "readonly", "file", "checkbox"]),
          ).toEqual({ larger: 17, support: 12, readonly: 14, file: 14, checkbox: 14 });
          const geometry = await page.evaluate((): { content: number; viewport: number } => ({
            content: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
          }));
          expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
        }
      } finally {
        await page.close();
      }
    });

    test("preserves compact fine-pointer desktop text and the fixed mobile shell", async (): Promise<void> => {
      const page = await browser.newPage();
      try {
        for (const width of [1024, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await loadFixture(page);
          await expectComposerMeasurementTypography(page);
          expect(
            await fontSizes(page, ["email", "hex", "ai-chat-input", "larger", "support"]),
          ).toEqual({ email: 14, hex: 12, "ai-chat-input": 14, larger: 17, support: 12 });
          expect(
            await page.locator("main").evaluate((element): number => element.clientWidth),
          ).toBe(448);
        }
      } finally {
        await page.close();
      }
    });

    test("also protects editable text on large touch screens", async (): Promise<void> => {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 1280, height: 900 },
      });
      try {
        const page = await context.newPage();
        await loadFixture(page);
        expect(
          await page.evaluate((): boolean => matchMedia("(any-pointer: coarse)").matches),
        ).toBe(true);
        const sizes = await fontSizes(page, editableIds);
        await expectComposerMeasurementTypography(page);
        expect(Object.values(sizes).every((size): boolean => size >= 16)).toBe(true);
        expect(await fontSizes(page, ["larger", "support"])).toEqual({ larger: 17, support: 12 });
      } finally {
        await context.close();
      }
    });
  },
);
