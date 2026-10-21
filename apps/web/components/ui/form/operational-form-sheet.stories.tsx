import type { Meta, StoryObj } from "@storybook/nextjs";
import { useEffect, useState } from "react";

import { FormField, TextInput } from "./basic-form-controls";
import { OperationalFormSheet } from "./guided-form";

function KeyboardDiagnostics(): React.JSX.Element {
  const [lines, setLines] = useState<readonly string[]>([]);
  const [panelTop, setPanelTop] = useState(8);
  useEffect((): (() => void) => {
    const visual = window.visualViewport;
    let frame: number | null = null;
    let sequence = 0;
    let signalTime = performance.now();
    const timers = new Set<number>();
    const number = (value: number | undefined): string =>
      value === undefined ? "—" : value.toFixed(1);

    function sample(source: string): void {
      const sheet = document.querySelector<HTMLElement>('[aria-label="Catat Pengeluaran"]');
      const sheetRect = sheet?.getBoundingClientRect();
      const hostRect = sheet?.parentElement?.getBoundingClientRect();
      const body = sheet?.querySelector<HTMLElement>('[data-sheet-body="true"]');
      const footer = body?.nextElementSibling;
      const footerRect = footer instanceof HTMLElement ? footer.getBoundingClientRect() : undefined;
      setPanelTop((visual?.offsetTop ?? 0) + 8);
      setLines([
        `${source} +${number(performance.now() - signalTime)}ms`,
        `winH ${number(window.innerHeight)} · docH ${number(document.documentElement.clientHeight)} · scrollY ${number(window.scrollY)}`,
        `vvH ${number(visual?.height)} · top ${number(visual?.offsetTop)} · scale ${number(visual?.scale)}`,
        `sheet T ${number(sheetRect?.top)} · B ${number(sheetRect?.bottom)} · H ${number(sheetRect?.height)}`,
        `footer T ${number(footerRect?.top)} · B ${number(footerRect?.bottom)}`,
        `CSS bottom ${sheet ? getComputedStyle(sheet).bottom : "—"} · footer gap ${number(footerRect && hostRect ? hostRect.bottom - footerRect.bottom : undefined)}`,
      ]);
    }

    function cancelSamples(): void {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      timers.forEach((timer: number): void => window.clearTimeout(timer));
      timers.clear();
    }

    function scheduleSamples(source: string): void {
      cancelSamples();
      const currentSequence = ++sequence;
      signalTime = performance.now();
      sample(source);
      frame = window.requestAnimationFrame((): void => {
        frame = null;
        if (currentSequence === sequence) sample(`${source}/raf`);
      });
      // Safari may report keyboard geometry after the animation. These samples end at 1s.
      [100, 350, 700, 1000].forEach((delay: number): void => {
        const timer = window.setTimeout((): void => {
          timers.delete(timer);
          if (currentSequence === sequence) sample(`${source}/${delay}`);
        }, delay);
        timers.add(timer);
      });
    }

    function onSignal(event: Event): void {
      scheduleSamples(event.type);
    }
    document.addEventListener("focusin", onSignal);
    window.addEventListener("resize", onSignal);
    window.addEventListener("scroll", onSignal);
    visual?.addEventListener("resize", onSignal);
    visual?.addEventListener("scroll", onSignal);
    scheduleSamples("mounted");
    return (): void => {
      sequence += 1;
      cancelSamples();
      document.removeEventListener("focusin", onSignal);
      window.removeEventListener("resize", onSignal);
      window.removeEventListener("scroll", onSignal);
      visual?.removeEventListener("resize", onSignal);
      visual?.removeEventListener("scroll", onSignal);
    };
  }, []);

  return (
    <aside
      style={{ top: panelTop }}
      className="pointer-events-none fixed inset-x-3 z-10000 rounded-inset bg-surface-container-lowest p-3 font-mono text-xs leading-5 text-on-surface shadow-raised"
    >
      {lines.map((line: string, index: number): React.JSX.Element => (
        <div key={index}>{line}</div>
      ))}
    </aside>
  );
}

function Demo({ diagnostics = false }: { readonly diagnostics?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("Pembelian Semen");
  return (
    <div className="h-140 w-full">
      {diagnostics ? <KeyboardDiagnostics /> : null}
      <OperationalFormSheet
        dismissal={{ mode: "discard" }}
        open={open}
        title="Catat Pengeluaran"
        submitLabel="Simpan"
        statusItems={[{ label: "Total", amount: 6400000 }]}
        onClose={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
      >
        <FormField label="Nama Item" required>
          <TextInput value={name} onChange={setName} />
        </FormField>
      </OperationalFormSheet>
    </div>
  );
}

const meta = {
  title: "ui/form/OperationalFormSheet",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};

/** Local Storybook only: no API calls or business mutations. */
export const KeyboardDiagnostic: Story = {
  render: () => <Demo diagnostics />,
};
