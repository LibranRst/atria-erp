import { describe, expect, test } from "bun:test";
import {
  readBackendSession,
  requestTypedBackendOperation,
  type BackendFetch,
} from "@atria/api-client";
import { z } from "zod";
import { createFixtureAPI, QA_BRIDGE_SECRET, QA_EMAIL, QA_PASSWORD } from "./fixture-api";
import { adminBackendHeaders, adminResponseHeaders } from "../lib/api/admin-cookies";
import { FIXTURE_PROJECT_ID, projectBudgetFixture } from "../features/projects/fixtures/projects";

function fixture(): {
  readonly fetcher: BackendFetch;
  readonly request: (path: string, init?: RequestInit) => Promise<Response>;
} {
  const api = createFixtureAPI();
  return {
    fetcher: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      api.fetch(new Request(input, init)),
    request: (path: string, init?: RequestInit): Promise<Response> =>
      api.fetch(new Request(`http://127.0.0.1:3301${path}`, init)),
  };
}
const connection = {
  origin: "http://127.0.0.1:3301",
  bridgeSecret: QA_BRIDGE_SECRET,
  timeoutMs: 1000,
};

async function login(api: ReturnType<typeof fixture>): Promise<Headers> {
  const response = await api.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
  });
  expect(response.status).toBe(200);
  const cookies = adminResponseHeaders(response.headers).getSetCookie();
  const ownCookie = cookies[0]?.split(";")[0];
  if (!ownCookie) throw new Error("Missing admin fixture cookie");
  return adminBackendHeaders(
    new Headers({ cookie: `better-auth.session_token=web-other-user; ${ownCookie}` }),
  );
}

describe("isolated admin browser QA API", (): void => {
  test("anonymous actor stays signed out; own admin cookie reaches real session and typed bridge transport", async (): Promise<void> => {
    const api = fixture();
    const anonymous = await requestTypedBackendOperation({
      connection,
      operation: "server/actor.resolveActor",
      args: [],
      headers: new Headers(),
      fetcher: api.fetcher,
    });
    expect(anonymous.envelope).toMatchObject({ ok: true, data: null });
    const headers = await login(api);
    const session = await readBackendSession({ connection, headers, fetcher: api.fetcher });
    expect(session?.user.email).toBe(QA_EMAIL);
    const actor = await requestTypedBackendOperation({
      connection,
      operation: "server/actor.resolveActor",
      args: [],
      headers,
      fetcher: api.fetcher,
    });
    if (!actor.envelope.ok || !actor.envelope.data) throw new Error("Fixture login failed");
    expect(actor.envelope.data.permissions).toContain("use:desktop_admin");
    const list = await requestTypedBackendOperation({
      connection,
      operation: "features/projects/list/server/get-project-list-page-data.getProjectListPageData",
      args: [actor.envelope.data],
      headers,
      fetcher: api.fetcher,
    });
    expect(list.envelope).toMatchObject({ ok: true, data: { status: "ready" } });
    const recorded = z
      .object({ operations: z.array(z.object({ credentialPresent: z.boolean() })) })
      .parse(await (await api.request("/__qa/state")).json());
    expect(recorded.operations.at(-1)?.credentialPresent).toBe(true);
  });

  test("typed category mutation persists only in its in-memory state and returns canonical invalidations", async (): Promise<void> => {
    const api = fixture();
    const headers = await login(api);
    const category = projectBudgetFixture.categories[0];
    if (!category) throw new Error("Missing fixture category");
    const result = await requestTypedBackendOperation({
      connection,
      operation: "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation",
      args: [{ projectBudgetCategoryId: category.id, allocatedAmount: 150_000_000 }],
      headers,
      fetcher: api.fetcher,
    });
    if (!result.envelope.ok || !result.envelope.data.success)
      throw new Error("Fixture mutation failed");
    expect(result.envelope.data.data.categories[0]?.allocatedAmount).toBe(150_000_000);
    expect(result.envelope.invalidations).toContainEqual({
      path: `/projects/${FIXTURE_PROJECT_ID}`,
    });
    const untouched = fixture();
    const originalHeaders = await login(untouched);
    const original = await requestTypedBackendOperation({
      connection,
      operation: "app/actions/project/excel-budget.getProjectBudgetDashboard",
      args: [FIXTURE_PROJECT_ID],
      headers: originalHeaders,
      fetcher: untouched.fetcher,
    });
    if (!original.envelope.ok || !original.envelope.data.success)
      throw new Error("Fixture read failed");
    expect(original.envelope.data.data.categories[0]?.allocatedAmount).toBe(
      category.allocatedAmount,
    );
  });

  test("QA controls simulate grant, scope, password and outage without an application bypass", async (): Promise<void> => {
    const api = fixture();
    const headers = await login(api);
    await api.request("/__qa/state", {
      method: "POST",
      body: JSON.stringify({ desktopAccess: false, scope: "ASSIGNED", temporaryPassword: true }),
    });
    const actor = await requestTypedBackendOperation({
      connection,
      operation: "server/actor.resolveActor",
      args: [],
      headers,
      fetcher: api.fetcher,
    });
    if (!actor.envelope.ok || !actor.envelope.data) throw new Error("Fixture actor missing");
    expect(actor.envelope.data.permissions).not.toContain("use:desktop_admin");
    expect(actor.envelope.data.dataScope).toBe("ASSIGNED");
    const guarded = await requestTypedBackendOperation({
      connection,
      operation: "app/actions/project/crud.getProjectFormData",
      args: [],
      headers,
      fetcher: api.fetcher,
    });
    expect(guarded.envelope).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await api.request("/__qa/state", { method: "POST", body: JSON.stringify({ outage: true }) });
    await expect(
      readBackendSession({ connection, headers, fetcher: api.fetcher }),
    ).rejects.toMatchObject({ code: "SESSION_UNAVAILABLE" });
  });
});
