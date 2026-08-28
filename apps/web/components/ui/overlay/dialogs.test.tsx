import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SuccessDialog, SUCCESS_DIALOG_FACT_LIMIT } from "./dialogs";

const framePath = new URL("./dialog-frame.tsx", import.meta.url);
const dialogsPath = new URL("./dialogs.tsx", import.meta.url);
const sheetsPath = new URL("./semantic-sheets.tsx", import.meta.url);
const optionListPath = new URL("../form/dialog-option-list.tsx", import.meta.url);
const calendarPath = new URL("../form/date-form-controls.tsx", import.meta.url);

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

  test("animates filtered search-result height without layout scaling", async () => {
    const [dialogs, options] = await Promise.all([
      Bun.file(dialogsPath).text(),
      Bun.file(optionListPath).text(),
    ]);

    expect(options).toContain("new ResizeObserver(measure)");
    expect(options).toContain("{ height: measuredHeight }");
    expect(options).toContain('className="flow-root"');
    expect(options).toContain("<motion.div");
    expect(options).not.toContain('layout="size"');
    expect(options).not.toContain("layout={true}");
    expect(dialogs).not.toContain("AnimatedSearchResults");
  });

  test("deepens the frame with one default or choice presentation", async () => {
    const source = await Bun.file(framePath).text();

    expect(source).toContain('presentation?: "default" | "choice"');
    expect(source).toContain('const choicePresentation = presentation === "choice"');
    expect(source).toContain("detachedCloseButton");
    expect(source).toContain("utility");
    expect(source).toContain('choicePresentation ? "bg-primary/32" : "bg-black/45"');
    expect(source).toContain('choicePresentation ? "bg-surface-container-low shadow-raised"');
    expect(source).toContain('choicePresentation ? "bg-surface-container-low py-4"');
    expect(source).toContain("shadow-overlay");
  });

  test("preserves grouped choice styling without rectangular selected fill", async () => {
    const [dialogs, options, calendar] = await Promise.all([
      Bun.file(dialogsPath).text(),
      Bun.file(optionListPath).text(),
      Bun.file(calendarPath).text(),
    ]);

    expect(dialogs).toContain('presentation="choice"');
    expect(dialogs).toContain("detachedCloseButton");
    expect(dialogs).toContain("utility={");
    expect(dialogs).toContain("rounded-full bg-white px-4 shadow-raised");
    expect(dialogs).not.toContain("sticky top-0");
    expect(dialogs).toContain('return <DialogFrame {...props} presentation="choice" />;');
    expect(options).toContain("divide-y divide-outline-variant/20");
    expect(options).toContain("mx-2 mb-2 overflow-hidden rounded-3xl bg-white");
    expect(options).not.toContain("rounded-inset bg-white ring-1");
    expect(options).not.toContain("bg-accent-container text-accent");
    expect(options).toContain('selected && "text-accent"');
    expect(options).toContain('"block text-row font-bold"');
    expect(options).not.toContain('"block truncate text-row font-bold"');
    expect(options).toContain('className="icon-sm shrink-0 text-accent"');
    expect(options).toContain("bg-surface-container-low px-5 py-2.5");
    expect(options).toContain("active:bg-surface-container");
    expect(calendar).toContain("rounded-3xl bg-surface-container-lowest");
  });

  test("restores the previous visual hierarchy for non-selection dialogs", async () => {
    const dialogs = await Bun.file(dialogsPath).text();

    expect(dialogs).toContain('className="icon-xl"');
    expect(dialogs).toContain("rounded-inset bg-white px-4 text-left ring-1");
    expect(dialogs).toContain("rounded-inset bg-white p-4 ring-1 ring-ring-subtle");
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
