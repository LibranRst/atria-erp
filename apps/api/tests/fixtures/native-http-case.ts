import { PGlite } from "@electric-sql/pglite";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { expect, mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { z } from "zod";
import * as schema from "@backend/db/schema";
import { DEMO_IDS } from "@backend/db/seed/demo-contract";
import { withCommitEffects } from "@backend/lib/db/commit-effects";
import { createApiApp } from "../../src/app";
import { readApiConfig } from "../../src/config";
import { BackgroundEffects } from "../../src/runtime/background-effects";
import type { AppRouter } from "@backend/server/trpc/root";

// This process never opens DATABASE_URL. Every business write uses this disposable database.
const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
const database = drizzle(postgres, { schema });
database.transaction = withCommitEffects(
  database.transaction.bind(database),
  (error: unknown): void => {
    throw error;
  },
);
mock.module("@backend/db", () => ({ db: database, pool: { end: async (): Promise<void> => {} } }));

let dispatch: (request: Request) => Response | Promise<Response> = (): Response =>
  new Response(null, { status: 503 });
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request: Request): Response | Promise<Response> => dispatch(request),
});
process.env.BETTER_AUTH_URL = server.url.origin;
process.env.API_PUBLIC_URL = server.url.origin;
process.env.WEB_ORIGIN = server.url.origin;
process.env.BETTER_AUTH_SECRET = "atria-disposable-native-http-test-secret";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/disposable-only";
const { auth } = await import("@backend/lib/auth");
const { appRouter } = await import("@backend/server/trpc/root");
const { createTRPCContext } = await import("@backend/server/trpc/init");
const { invokeWebOperation, isWebOperation } = await import("@backend/server/web-rpc/registry");
const { seedDemoDatabase } = await import("@backend/db/seed");
const { runAllInvariants } = await import("@backend/lib/finance/ledger-invariants");
const { POST: chat } = await import("@backend/app/api/ai/chat/route");
const { GET: notificationStream } = await import("@backend/app/api/notifications/stream/route");
const effects = new BackgroundEffects((error: unknown): void => {
  console.error(error);
});

try {
  await database
    .insert(schema.tenant)
    .values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable" });
  await seedDemoDatabase();
  const app = createApiApp(
    readApiConfig(process.env),
    {
      auth: (request: Request): Promise<Response> => auth.handler(request),
      trpc: (request: Request): Promise<Response> =>
        fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: createTRPCContext,
        }),
      chat,
      notificationStream,
      notificationJob: (): Response => new Response(null, { status: 503 }),
      isWebOperation,
      invokeWebOperation,
      readiness: async (): Promise<void> => {
        await database.query.tenant.findFirst();
      },
      isDraining: (): boolean => false,
    },
    effects,
  );
  dispatch = app.fetch;

  const login = await fetch(new URL("/api/auth/sign-in/email", server.url), {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url.origin },
    body: JSON.stringify({ email: "ronald@dekoria.com", password: "password123" }),
  });
  expect(login.status).toBe(200);
  const { token } = z.object({ token: z.string() }).parse(await login.json());
  const cookie = login.headers
    .getSetCookie()
    .map((value: string): string => value.split(";")[0])
    .join("; ");
  expect(cookie).not.toBe("");
  const native = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: new URL("/api/trpc", server.url).href,
        transformer: superjson,
        headers: { authorization: `Bearer ${token}` },
      }),
    ],
  });
  const home = await native.screen.ledger.query();
  expect(home.status).toBe("ready");
  if (home.status !== "ready") throw new Error("Home loader failed");
  const cash = home.overview.recentTransactions[0];
  if (!cash) throw new Error("Disposable Home has no cash transaction");
  const cashDetail = await native.screen.activityDetail.query({
    kind: "CASH_TRANSACTION",
    id: cash.id,
  });
  expect(cashDetail.success).toBe(true);
  if (!cashDetail.success) throw new Error(cashDetail.error.message);
  expect(cashDetail.data.id).toBe(cash.id);
  expect(cashDetail.data.title).toBe(cash.description);
  expect(
    cashDetail.data.facts.some(
      (item) => item.value.type === "MONEY" && item.value.value === cash.amount,
    ),
  ).toBe(true);
  const missingCash = await native.screen.activityDetail.query({
    kind: "CASH_TRANSACTION",
    id: "00000000-0000-0000-0000-000000000099",
  });
  expect(missingCash).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  expect((await native.screen.projects.query()).status).toBe("ready");
  expect((await native.screen.expenses.query()).status).toBe("ready");
  expect((await native.screen.newExpense.query()).projects.length).toBeGreaterThan(0);

  const budget = await database.query.projectBudgets.findFirst({
    where: eq(schema.projectBudgets.projectId, DEMO_IDS.projects.menteng),
  });
  if (!budget) throw new Error("Missing disposable project budget");
  const categories = await database.query.projectBudgetCategory.findMany({
    where: eq(schema.projectBudgetCategory.projectBudgetId, budget.id),
    with: { expenseCategory: true },
  });
  const category = categories.find((item) => item.expenseCategory.code === "OPERASIONAL");
  if (!category) throw new Error("Missing disposable expense category");
  const draft = await native.finance.saveExpenseDraft.mutate({
    payload: {
      projectId: DEMO_IDS.projects.menteng,
      inputMode: "MANUAL",
      receipt: null,
      ocrWarning: null,
      lines: [
        {
          key: "standalone-test",
          projectBudgetCategoryId: category.id,
          projectBudgetItemId: "",
          materialId: "",
          projectRapItemId: "",
          projectCategoryPlanItemId: "",
          stockHandling: "EXPENSE_ONLY",
          inventoryLocationId: "",
          quantity: 1,
          unitPrice: 10000,
          amount: 10000,
          description: "Disposable standalone HTTP expense",
        },
      ],
    },
  });
  expect(draft.success).toBe(true);
  if (!draft.success) throw new Error(draft.error.message);
  const submitted = await native.finance.submitExpenseDraft.mutate({
    draftId: draft.data.id,
    expectedRevision: draft.data.revision,
  });
  expect(submitted.success).toBe(true);
  if (!submitted.success) throw new Error(submitted.error.message);
  const repeated = await native.finance.submitExpenseDraft.mutate({
    draftId: draft.data.id,
    expectedRevision: draft.data.revision,
  });
  expect(repeated.success).toBe(true);
  expect(repeated).toMatchObject({ success: true, data: { idempotent: true } });
  expect(
    (
      await database
        .select()
        .from(schema.projectCost)
        .where(eq(schema.projectCost.description, "Disposable standalone HTTP expense"))
    ).length,
  ).toBe(1);

  const costId = submitted.data.projectCostIds[0];
  if (!costId) throw new Error("Missing submitted expense");
  const verification = await fetch(new URL("/api/internal/web-rpc", server.url), {
    method: "POST",
    headers: { "x-atria-bridge-secret": readApiConfig(process.env).API_BRIDGE_SECRET, cookie },
    body: superjson.stringify({
      operation: "app/actions/finance/field-requests.verifyFieldRequest",
      args: [costId],
    }),
  });
  expect(verification.status).toBe(200);
  expect(superjson.parse(await verification.text())).toMatchObject({
    ok: true,
    data: { success: true, data: { status: "APPROVED" } },
  });
  const accountBefore = await database.query.bankAccount.findFirst({
    where: eq(schema.bankAccount.id, DEMO_IDS.bankAccounts.bcaOperational),
  });
  const payment = await native.finance.payFieldRequest.mutate({
    projectCostId: costId,
    bankAccountId: DEMO_IDS.bankAccounts.bcaOperational,
    referenceNumber: "DISPOSABLE-HTTP-PAYMENT",
  });
  expect(payment.success).toBe(true);
  const accountAfter = await database.query.bankAccount.findFirst({
    where: eq(schema.bankAccount.id, DEMO_IDS.bankAccounts.bcaOperational),
  });
  expect(Number(accountBefore?.balance) - Number(accountAfter?.balance)).toBe(10000);
  expect(
    (
      await native.finance.payFieldRequest.mutate({
        projectCostId: costId,
        bankAccountId: DEMO_IDS.bankAccounts.bcaOperational,
        referenceNumber: "DISPOSABLE-HTTP-PAYMENT",
      })
    ).success,
  ).toBe(false);
  expect(
    (
      await database
        .select()
        .from(schema.cashTransaction)
        .where(eq(schema.cashTransaction.referenceId, costId))
    ).length,
  ).toBe(1);

  const bridge = await fetch(new URL("/api/internal/web-rpc", server.url), {
    method: "POST",
    headers: { "x-atria-bridge-secret": readApiConfig(process.env).API_BRIDGE_SECRET, cookie },
    body: superjson.stringify({ operation: "server/actor.resolveActor", args: [] }),
  });
  expect(bridge.status).toBe(200);
  expect(superjson.parse(await bridge.text())).toMatchObject({
    ok: true,
    data: { userId: DEMO_IDS.users.owner },
  });
  const invariants = await runAllInvariants();
  expect(invariants).toHaveLength(6);
  expect(invariants.flatMap((item) => item.violations)).toEqual([]);
  const pmLogin = await fetch(new URL("/api/auth/sign-in/email", server.url), {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url.origin },
    body: JSON.stringify({ email: "budi@dekoria.com", password: "password123" }),
  });
  expect(pmLogin.status).toBe(200);
  const pmToken = z.object({ token: z.string() }).parse(await pmLogin.json()).token;
  const pmCookie = pmLogin.headers
    .getSetCookie()
    .map((value: string): string => value.split(";")[0])
    .join("; ");
  const pmNative = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: new URL("/api/trpc", server.url).href,
        transformer: superjson,
        headers: { authorization: `Bearer ${pmToken}` },
      }),
    ],
  });
  await expect(
    pmNative.screen.activityDetail.query({ kind: "CASH_TRANSACTION", id: cash.id }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  const pmProjects = await pmNative.screen.projects.query();
  expect(pmProjects.status).toBe("ready");
  if (pmProjects.status !== "ready") throw new Error("PM project loader failed");
  const assigned = await database.query.project.findMany({
    where: eq(schema.project.projectManagerId, DEMO_IDS.users.pmBudi),
    columns: { id: true },
  });
  expect(pmProjects.projects.map((item) => item.id).sort()).toEqual(
    assigned.map((item) => item.id).sort(),
  );
  const spoofedActor = await fetch(new URL("/api/internal/web-rpc", server.url), {
    method: "POST",
    headers: {
      "x-atria-bridge-secret": readApiConfig(process.env).API_BRIDGE_SECRET,
      cookie: pmCookie,
    },
    body: superjson.stringify({
      operation: "features/projects/list/server/get-project-list-page-data.getProjectListPageData",
      args: [
        {
          userId: DEMO_IDS.users.owner,
          roleId: "00000000-0000-0000-0000-000000000001",
          roleName: "OWNER",
          permissions: ["view:budget"],
          dataScope: "GLOBAL",
        },
      ],
    }),
  });
  const scopedBridge = z
    .object({
      ok: z.literal(true),
      data: z.object({ projects: z.array(z.object({ id: z.string() })) }),
    })
    .parse(superjson.parse(await spoofedActor.text()));
  expect(scopedBridge.data.projects.map((item) => item.id).sort()).toEqual(
    assigned.map((item) => item.id).sort(),
  );

  await database
    .update(schema.user)
    .set({ mustChangePassword: true })
    .where(eq(schema.user.id, DEMO_IDS.users.owner));
  for (const endpoint of ["/api/ai/chat", "/api/notifications/stream"]) {
    const response = await fetch(new URL(endpoint, server.url), {
      method: endpoint.endsWith("chat") ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  }
  await expect(native.screen.projects.query()).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });
  await database
    .update(schema.user)
    .set({ mustChangePassword: false })
    .where(eq(schema.user.id, DEMO_IDS.users.owner));

  await database
    .update(schema.user)
    .set({ isActive: false })
    .where(eq(schema.user.id, DEMO_IDS.users.owner));
  await expect(native.screen.projects.query()).rejects.toMatchObject({
    data: { code: "UNAUTHORIZED" },
  });
  expect(
    (
      await fetch(new URL("/api/ai/chat", server.url), {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
  ).toBe(401);
  console.log(
    "Standalone native HTTP: login, cookie/bearer, 4 loaders, draft/submit/verify/pay, deduplication, revocation, 6 invariants passed",
  );
} finally {
  await server.stop(true);
  await effects.drain(5000);
  await postgres.close();
}
