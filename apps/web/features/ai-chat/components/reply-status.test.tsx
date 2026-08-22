import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { thinkingDotAnimation } from "@/lib/utils/motion";
import { PendingReplyIndicator } from "./reply-status";
import { REPLY_PHASE_LABEL } from "../utils/reply-phase";

describe("PendingReplyIndicator", () => {
  test("memakai tiga fase yang disepakati", () => {
    expect(Object.values(REPLY_PHASE_LABEL)).toEqual([
      "Menganalisis…",
      "Mengambil data…",
      "Menyusun jawaban…",
    ]);
  });

  test("merender assistant row yang terlihat tanpa surface atau bubble", () => {
    const html = renderToStaticMarkup(
      <PendingReplyIndicator displayedPhase="fetching" visible contentVisible={false} />,
    );

    expect(html).toContain("Mengambil data…");
    expect(html).toContain("min-h-11");
    expect(html).toContain("py-2");
    expect(html).toContain("h-7 w-7");
    expect(html).toContain("gap-2.5");
    expect(html).toContain("text-row");
    expect(html).toContain("font-semibold");
    expect(html.match(/h-1\.5 w-1\.5/g)).toHaveLength(3);
    expect(html.match(/bg-primary/g)).toHaveLength(3);
    expect(html).toContain("pointer-events-none");
    expect(html).not.toContain("bg-on-primary");
    expect(html).not.toContain("gap-0.5 rounded-full bg-primary");
    expect(html).not.toContain("Asisten siap");
    expect(html).not.toContain("bg-surface-container");
    expect(html).not.toContain("shadow-");
    expect(html).not.toContain("rounded-t-");
  });

  test("memisahkan visual row dari satu live region persisten", () => {
    const active = renderToStaticMarkup(
      <PendingReplyIndicator displayedPhase="analyzing" visible contentVisible={false} />,
    );
    const handedOff = renderToStaticMarkup(
      <PendingReplyIndicator displayedPhase="analyzing" visible contentVisible />,
    );

    expect(active).toContain('aria-hidden="true"');
    expect(active).toContain('role="status"');
    expect(active).toContain('aria-live="polite"');
    expect(active).toContain('aria-atomic="true"');
    expect(active.match(/role="status"/g)).toHaveLength(1);
    expect(handedOff).toContain(
      '<span class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>',
    );
  });

  test("menyiapkan rise-fade hanya untuk kemunculan awal", () => {
    const hidden = renderToStaticMarkup(
      <PendingReplyIndicator displayedPhase="analyzing" visible={false} contentVisible={false} />,
    );

    expect(hidden).toContain("opacity:0");
    expect(hidden).toContain("translateY(6px)");
  });

  test("dots hanya mengubah opacity tanpa scale atau perpindahan", () => {
    expect(thinkingDotAnimation).toEqual({ opacity: [0.25, 1, 0.25] });
    expect("scale" in thinkingDotAnimation).toBe(false);
    expect("x" in thinkingDotAnimation).toBe(false);
    expect("y" in thinkingDotAnimation).toBe(false);
  });
});
