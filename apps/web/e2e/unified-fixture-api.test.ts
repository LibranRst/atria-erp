import { expect, test } from "bun:test";
import superjson from "superjson";
import { z } from "zod";
import {
  createUnifiedFixtureAPI,
  QA_BRIDGE_SECRET,
  QA_EMAIL,
  QA_PASSWORD,
} from "./unified-fixture-api";

const envelope = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string() }).optional(),
});
const dashboard = z.object({
  status: z.literal("ready"),
  overview: z.object({
    generatedAt: z.date(),
    summary: z.object({ projectValue: z.number(), internalBudget: z.number() }),
    bankAccounts: z.array(z.object({ name: z.string() })),
  }),
});
const fixtureURL = "http://127.0.0.1:3441";
type Fixture = ReturnType<typeof createUnifiedFixtureAPI>;

function rpc(
  fixture: Fixture,
  operation: string,
  cookie: string,
  secret = QA_BRIDGE_SECRET,
  args: readonly unknown[] = [],
): Promise<Response> {
  return fixture.fetch(
    new Request(`${fixtureURL}/api/internal/web-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atria-bridge-secret": secret, cookie },
      body: superjson.stringify({ operation, args }),
    }),
  );
}
async function login(fixture: Fixture): Promise<string> {
  const response = await fixture.fetch(
    new Request(`${fixtureURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

test("unified fixture uses canonical web cookies and retains typed Dashboard Dates", async () => {
  const fixture = createUnifiedFixtureAPI();
  const cookie = await login(fixture);
  expect(cookie.startsWith("better-auth.session_token=")).toBe(true);
  const response = await rpc(
    fixture,
    "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData",
    cookie,
  );
  expect(response.status).toBe(200);
  const result = envelope.parse(superjson.parse<unknown>(await response.text()));
  const data = dashboard.parse(result.data);
  expect(data.overview.generatedAt).toBeInstanceOf(Date);
  expect(data.overview.summary.projectValue).toBe(570_000_000);
  expect(data.overview.summary.internalBudget).toBe(399_000_000);
  expect(data.overview.bankAccounts[0]?.name).toBe("Rekening Pengujian");
});

test("additional review operations require the bridge secret and canonical valid session", async () => {
  const fixture = createUnifiedFixtureAPI();
  const cookie = await login(fixture);
  const operation =
    "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData";
  expect((await rpc(fixture, operation, cookie, "wrong-secret")).status).toBe(401);
  expect((await rpc(fixture, operation, "")).status).toBe(401);
  expect(
    (await rpc(fixture, operation, cookie.replace("better-auth.", "atria-admin."))).status,
  ).toBe(401);
  const fakeActor = { permissions: ["view:ledger"], dataScope: "GLOBAL" };
  expect((await rpc(fixture, operation, "", QA_BRIDGE_SECRET, [fakeActor])).status).toBe(401);
});

test("base exact QA schema and scoped domain access work without a desktop grant", async () => {
  const fixture = createUnifiedFixtureAPI();
  const cookie = await login(fixture);
  const update = await fixture.fetch(
    new Request(`${fixtureURL}/__qa/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "custom",
        desktopAccess: false,
        scope: "ASSIGNED",
        domainAccess: true,
      }),
    }),
  );
  expect(update.status).toBe(200);
  const actorResponse = await rpc(fixture, "server/actor.resolveActor", cookie);
  const actor = z
    .object({ permissions: z.array(z.string()), dataScope: z.literal("ASSIGNED") })
    .parse(envelope.parse(superjson.parse<unknown>(await actorResponse.text())).data);
  expect(actor.permissions).toContain("view:budget");
  expect(actor.permissions).not.toContain("use:desktop_admin");
  const projectResponse = await rpc(
    fixture,
    "features/projects/list/server/get-project-list-page-data.getProjectListPageData",
    cookie,
  );
  const projectList = z
    .object({ status: z.literal("ready"), projects: z.array(z.object({ name: z.string() })) })
    .parse(envelope.parse(superjson.parse<unknown>(await projectResponse.text())).data);
  expect(projectList.projects).toHaveLength(1);
  const restricted = await rpc(
    fixture,
    "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData",
    cookie,
  );
  expect(envelope.parse(superjson.parse<unknown>(await restricted.text())).data).toEqual({
    status: "restricted",
  });
  const invalid = await fixture.fetch(
    new Request(`${fixtureURL}/__qa/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unexpected: true }),
    }),
  );
  expect(invalid.status).toBe(400);
});

test("empty data, outage, and expiry retain their real fixture semantics", async () => {
  const fixture = createUnifiedFixtureAPI();
  const cookie = await login(fixture);
  async function state(options: object): Promise<void> {
    await fixture.fetch(
      new Request(`${fixtureURL}/__qa/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(options),
      }),
    );
  }
  const operation =
    "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData";
  await state({ empty: true });
  const empty = dashboard.parse(
    envelope.parse(superjson.parse<unknown>(await (await rpc(fixture, operation, cookie)).text()))
      .data,
  );
  expect(empty.overview.summary.projectValue).toBe(0);
  expect(empty.overview.bankAccounts).toHaveLength(0);
  await state({ outage: true });
  expect((await rpc(fixture, operation, cookie)).status).toBe(503);
  await state({ outage: false, expired: true });
  expect((await rpc(fixture, operation, cookie)).status).toBe(401);
});
