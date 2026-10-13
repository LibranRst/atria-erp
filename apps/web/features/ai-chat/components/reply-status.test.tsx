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

  test("renders a contextual activity row without a separate card", () => {
    const html = renderToStaticMarkup(
      <PendingReplyIndicator displayedPhase="fetching" visible contentVisible={false} />,
    );
    expect(html).toContain("Mengambil data…");
    expect(html).toContain("min-h-12");
    expect(html).toContain("pointer-events-none");
    expect(html).not.toContain("shadow-");
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
