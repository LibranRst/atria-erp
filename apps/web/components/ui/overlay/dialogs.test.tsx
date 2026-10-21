import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CompactFormDialog,
  ConfirmationDialog,
  SuccessDialog,
  SUCCESS_DIALOG_FACT_LIMIT,
} from "./dialogs";
import { DialogFrame } from "./dialog-frame";

const framePath = new URL("./dialog-frame.tsx", import.meta.url);
const viewportPath = new URL("./overlay-viewport.ts", import.meta.url);
const dialogsPath = new URL("./dialogs.tsx", import.meta.url);
const sheetsPath = new URL("./semantic-sheets.tsx", import.meta.url);
const optionListPath = new URL("../form/dialog-option-list.tsx", import.meta.url);
const calendarPath = new URL("./calendar-dialog.tsx", import.meta.url);
const mediaPath = new URL("./media-preview-dialog.tsx", import.meta.url);

describe("contextual dialog taxonomy", () => {
  test("centralizes focus, visual viewport, layering, and reduced-motion behavior", async () => {
    const [source, viewport] = await Promise.all([
      Bun.file(framePath).text(),
      Bun.file(viewportPath).text(),
    ]);

    expect(source).toContain("observeOverlayViewport");
    expect(viewport).toContain("window.visualViewport");
    expect(source).toContain('window.addEventListener("keydown"');
    expect(source).toContain("<OverlayLayerProvider anchored={zIndex + 2}>");
    expect(source).toContain('role?: "dialog" | "alertdialog"');
    expect(source).toContain("useReducedMotion");
  });

  test("compact and confirmation dialogs forward logical focus return to the shared frame owner", () => {
    const returnFocusRef = { current: null };
    const compact = CompactFormDialog({
      open: false,
      title: "Form",
      children: null,
      actions: null,
      onClose: (): void => {},
      returnFocusRef,
    });
    const confirmation = ConfirmationDialog({
      open: false,
      title: "Confirm",
      description: "Read-only contract fixture.",
      confirmLabel: "Continue",
      onConfirm: (): void => {},
      onClose: (): void => {},
      returnFocusRef,
    });
    expect(compact.type).toBe(DialogFrame);
    expect(confirmation.type).toBe(DialogFrame);
    expect(compact.props.returnFocusRef).toBe(returnFocusRef);
    expect(confirmation.props.returnFocusRef).toBe(returnFocusRef);
  });

  test("keeps search top-biased and compact/calendar dialogs centered", async () => {
    const [source, calendar] = await Promise.all([
      Bun.file(dialogsPath).text(),
      Bun.file(calendarPath).text(),
    ]);

    expect(source).toContain('placement="top"');
    expect(source).toContain("export function CompactFormDialog");
    expect(source).toContain("export function SelectionDialog");
    expect(source).toContain("export { CalendarDialog");
    expect(calendar).toContain("export function CalendarDialog");
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

    expect(source).toContain('presentation?: "default" | "choice" | "calendar"');
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
    expect(options).toContain('className="overflow-hidden rounded-3xl bg-white"');
    expect(options).not.toContain("rounded-inset bg-white ring-1");
    expect(options).not.toContain("bg-accent-container text-accent");
    expect(options).toContain('selected && "text-accent"');
    expect(options).toContain('"block text-row font-bold"');
    expect(options).not.toContain('"block truncate text-row font-bold"');
    expect(options).toContain('className="icon-sm shrink-0 text-accent"');
    expect(options).toContain("bg-surface-container-low px-5 py-2.5");
    expect(options).toContain("active:bg-surface-container");
    expect(calendar).toContain("<DialogFrame");
    expect(calendar).toContain('presentation="calendar"');
    expect(calendar).toContain("rounded-3xl bg-surface-container-lowest");
    expect(calendar).toContain('role="grid"');
    expect(calendar).toContain("h-9 w-9");
    expect(calendar).toContain("aspect-square");
    expect(calendar).toContain("min-h-10");
    expect(calendar).toContain("Hari Ini");
    expect(calendar).not.toContain("createPortal");
    expect(calendar).not.toContain("lockBodyScroll");
    expect(calendar).not.toContain("transition: reduceMotion");
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

  test("keeps media preview on the shared dialog foundation", async () => {
    const source = await Bun.file(mediaPath).text();

    expect(source).toContain("<DialogFrame");
    expect(source).toContain('role="alert"');
    expect(source).toContain("Pratinjau tidak dapat dimuat");
    expect(source).not.toContain("createPortal");
    expect(source).not.toContain("z-100");
  });

  test("exports a semantic morph wrapper instead of exposing raw DialogFrame", async () => {
    const source = await Bun.file(dialogsPath).text();

    expect(source).toContain("export function MorphDetailDialog");
    expect(source).toContain('presentation="choice"');
  });
});
