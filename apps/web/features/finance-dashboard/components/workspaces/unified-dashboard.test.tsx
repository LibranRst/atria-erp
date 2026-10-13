import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { requestTypedBackendOperation } from "@atria/api-client";
import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { createUnifiedFixtureAPI, QA_BRIDGE_SECRET } from "@/e2e/unified-fixture-api";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import LedgerLoading from "@/app/ledger/loading";
import { BudgetRiskTab } from "../tabs/tab-budget-risk";
import { DashboardOverviewTab } from "../tabs/tab-overview";

async function fixtureOverview(): Promise<FinanceDashboardOverview> {
  const api = createUnifiedFixtureAPI();
  const { envelope } = await requestTypedBackendOperation({
    connection: {
      origin: "http://fixture.invalid",
      bridgeSecret: QA_BRIDGE_SECRET,
      timeoutMs: 1000,
    },
    operation: "app/actions/finance/dashboard-overview.getFinanceDashboardOverview",
    args: [],
    headers: new Headers({ cookie: "better-auth.session_token=qa-fixture-session" }),
    fetcher: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      api.fetch(new Request(input, init)),
  });
  if (!envelope.ok || !envelope.data.success) throw new Error("Fixture unavailable.");
  return envelope.data.data;
}

test("initial desktop budget category reading order follows the server, not alphabetical headers", async () => {
  const data = await fixtureOverview();
  const html = renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <BudgetRiskTab data={data} showSummary={false} />
    </WorkspacePresentationProvider>,
  );
  const table = html.slice(html.indexOf('aria-label="Penggunaan kategori budget"'));
  expect(table.indexOf(">Material<")).toBeGreaterThan(-1);
  expect(table.indexOf(">Material<")).toBeLessThan(table.indexOf(">Tukang<"));
  expect(table.indexOf(">Tukang<")).toBeLessThan(table.indexOf(">Operasional<"));
  expect(table.indexOf(">Operasional<")).toBeLessThan(table.indexOf(">Lain-lain<"));
});

test("desktop risk data has one comparison owner while mobile retains its preview", async () => {
  const data = await fixtureOverview();
  const render = (presentation: "mobile" | "desktop"): string =>
    renderToStaticMarkup(
      <WorkspacePresentationProvider presentation={presentation}>
        <DashboardOverviewTab
          data={data}
          financialPosition={<p>Ringkasan mobile</p>}
          setup={null}
        />
      </WorkspacePresentationProvider>,
    );
  expect((render("desktop").match(/aria-label="Proyek prioritas"/g) ?? []).length).toBe(1);
  expect((render("mobile").match(/Project berisiko/g) ?? []).length).toBe(1);
});

test("Dashboard skeleton follows desktop hierarchy and the native mobile hint", () => {
  const render = (presentation: "mobile" | "desktop", nativeBridge = false): string =>
    renderToStaticMarkup(
      <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeBridge}>
        <LedgerLoading />
      </WorkspacePresentationProvider>,
    );
  expect(render("desktop")).toContain('aria-label="Memuat Dashboard desktop"');
  expect(render("desktop")).toContain("arus kas, kategori, dan proyek prioritas");
  expect(render("mobile", true)).toContain('aria-label="Memuat Dashboard"');
  expect(render("mobile", true)).not.toContain("Memuat Dashboard desktop");
});
