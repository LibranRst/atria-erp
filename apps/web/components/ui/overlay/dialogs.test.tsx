import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SuccessDialog, SUCCESS_DIALOG_FACT_LIMIT } from "./dialogs";

const framePath = new URL("./dialog-frame.tsx", import.meta.url);
const dialogsPath = new URL("./dialogs.tsx", import.meta.url);
const sheetsPath = new URL("./semantic-sheets.tsx", import.meta.url);

describe("contextual dialog taxonomy", () => {
  test("centralizes focus, visual viewport, layering, and reduced-motion behavior", async () => {
    const source = await Bun.file(framePath).text();

    expect(source).toContain("window.visualViewport?.height");
    expect(source).toContain('window.addEventListener("keydown"');
    expect(source).toContain("<OverlayLayerProvider anchored={zIndex + 2}>");
    expect(source).toContain('role?: "dialog" | "alertdialog"');
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("previousFocus.focus");
  });

  test("keeps search top-biased and compact/calendar dialogs centered", async () => {
    const source = await Bun.file(dialogsPath).text();

    expect(source).toContain('placement="top"');
    expect(source).toContain("export function CompactFormDialog");
    expect(source).toContain("export function SelectionDialog");
    expect(source).toContain("export function CalendarDialog");
  });

  test("limits success facts to the confirmed compact contract", () => {
    const facts = Array.from({ length: SUCCESS_DIALOG_FACT_LIMIT + 1 }, (_, index) => ({
      label: `Fakta ${index + 1}`,
      value: String(index + 1),
    }));

    expect(() =>
      renderToStaticMarkup(
        <SuccessDialog
          open
          title="Berhasil"
          description="Selesai"
          facts={facts}
          onClose={() => undefined}
        />,
      ),
    ).toThrow(`SuccessDialog menerima maksimal ${SUCCESS_DIALOG_FACT_LIMIT} fakta.`);
  });

  test("keeps raw BottomSheet behind semantic wrappers", async () => {
    const source = await Bun.file(sheetsPath).text();

    expect(source).toContain("export function FormSheet");
    expect(source).toContain("export function DetailSheet");
    expect(source).toContain("<BottomSheet");
  });
});
