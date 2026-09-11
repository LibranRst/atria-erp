import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import { OrganizationSetupCard } from "./organization-setup-card";

const base: OrganizationSetupOverview = {
  canManageQuickStart: true,
  hasPersistedState: true,
  freshInstall: false,
  shouldAutoOpen: false,
  quickStart: {
    state: {
      version: 2,
      status: "COMPLETED",
      currentStep: "success",
      reviewedSteps: ["welcome", "financial_defaults", "first_project", "success"],
      firstProjectId: "11111111-1111-4111-8111-111111111111",
      initialStockDecision: "UNDECIDED",
      startedAt: "2026-08-31T00:00:00.000Z",
      completedAt: "2026-08-31T00:10:00.000Z",
    },
    progress: { current: 2, total: 2, percentage: 100, label: "Quick start selesai" },
  },
  requiredReadiness: [
    {
      id: "core_team",
      label: "Tim inti",
      detail: "Lengkapi tim inti.",
      ready: false,
      status: "INCOMPLETE",
      action: { href: "/settings?tab=organization", label: "Kelola tim" },
    },
  ],
  recommendedReadiness: [],
  requiredReadyCount: 0,
  requiredTotal: 1,
  allRequiredReady: false,
};

describe("organization setup card", () => {
  test("uses readiness counts without combining them with quick-start percentage", () => {
    const html = renderToStaticMarkup(
      <OrganizationSetupCard overview={base} density="dashboard" />,
    );
    expect(html).toContain("1 fondasi wajib tersisa");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("0 dari 1 fondasi wajib siap");
    expect(html).not.toContain("100%");
  });

  test("auto-hides in dashboard and settings after every required item is ready", () => {
    const ready: OrganizationSetupOverview = {
      ...base,
      requiredReadiness: base.requiredReadiness.map((item) => ({
        ...item,
        ready: true,
        status: "READY",
      })),
      requiredReadyCount: 1,
      allRequiredReady: true,
    };
    expect(
      renderToStaticMarkup(<OrganizationSetupCard overview={ready} density="dashboard" />),
    ).toBe("");
    expect(
      renderToStaticMarkup(<OrganizationSetupCard overview={ready} density="settings" />),
    ).toBe("");
  });
});
