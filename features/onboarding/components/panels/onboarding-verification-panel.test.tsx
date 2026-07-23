import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { OnboardingVerificationSnapshot } from "@/lib/onboarding/owner-onboarding";
import { OnboardingVerificationPanel } from "./onboarding-verification-panel";

const snapshot: OnboardingVerificationSnapshot = {
  kind: "bank_accounts",
  capturedAt: "2026-07-18T00:00:00.000Z",
  status: "READY",
  title: "Rekening dan dampak kas",
  facts: [
    { label: "Saldo aktual", value: "Rp110.000.000" },
    { label: "Ledger saldo awal", value: "Tercatat" },
  ],
};

describe("onboarding verification disclosure", () => {
  test("starts collapsed while keeping its status and summary discoverable", () => {
    const html = renderToStaticMarkup(<OnboardingVerificationPanel snapshot={snapshot} />);

    expect(html).toContain("Status langkah");
    expect(html).toContain("Rekening perusahaan sudah tercatat.");
    expect(html).toContain("Siap digunakan");
    expect(html).not.toContain("fakta");
    expect(html).not.toContain("database");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Saldo aktual");
    expect(html).not.toContain("Rp110.000.000");
  });
});
