import { expect } from "bun:test";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { DEMO_IDS } from "@/db/seed/demo-contract";

let handleRequest: ((request: Request) => Promise<Response>) | null = null;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request: Request): Response | Promise<Response> => {
    return handleRequest ? handleRequest(request) : new Response(null, { status: 503 });
  },
});
process.env.BETTER_AUTH_URL = server.url.origin;
process.env.NEXT_PUBLIC_APP_URL = server.url.origin;
process.env.BETTER_AUTH_SECRET = "atria-local-http-test-secret-no-production-usage";
const { auth } = await import("@/lib/auth");
const { db, pool } = await import("@/db");
const { rolePermission, cashTransaction, user } = await import("@/db/schema");
const { createTRPCRouter, createTRPCContext } = await import("@/server/trpc/init");
const { financeRouter } = await import("@/server/trpc/routers/finance");
const router = createTRPCRouter({ finance: financeRouter });
handleRequest = async (request: Request): Promise<Response> => {
  if (new URL(request.url).pathname.startsWith("/api/auth/")) return auth.handler(request);
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router,
    createContext: createTRPCContext,
  });
};
const financeRoleId = "00000000-0000-0000-0000-000000000002";
const permissionFilter = and(
  eq(rolePermission.roleId, financeRoleId),
  eq(rolePermission.permissionKey, "pay:cost"),
);
const original = await db.select().from(rolePermission).where(permissionFilter);

async function pay(token?: string, cookie?: string): Promise<Response> {
  return fetch(new URL("/api/trpc/finance.payFieldRequest", server.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({
      json: {
        projectCostId: "00000000-0000-4000-8000-000000000999",
        bankAccountId: DEMO_IDS.bankAccounts.bcaOperational,
        referenceNumber: "HTTP-AUTH-TEST",
      },
    }),
  });
}

try {
  expect(original).toHaveLength(1);
  expect((await pay()).status).toBe(401);
  expect((await pay("invalid-token")).status).toBe(401);
  const financeUser = await db.query.user.findFirst({
    where: eq(user.id, DEMO_IDS.users.finance),
    columns: { email: true },
  });
  if (!financeUser) throw new Error("Fixture Finance belum tersedia");
  const login = await fetch(new URL("/api/auth/sign-in/email", server.url), {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url.origin },
    body: JSON.stringify({ email: financeUser.email, password: "password123" }),
  });
  expect(login.status).toBe(200);
  const { token } = z.object({ token: z.string().min(1) }).parse(await login.json());
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie.length).toBeGreaterThan(0);
  const beforeLedger = await db.select({ id: cashTransaction.id }).from(cashTransaction);
  const permitted = await pay(token);
  expect(permitted.status).toBe(200);
  expect((await pay(undefined, cookie)).status).toBe(200);
  expect(await permitted.json()).toMatchObject({
    result: { data: { json: { success: false, error: { code: "NOT_FOUND" } } } },
  });
  await db.delete(rolePermission).where(permissionFilter);
  expect((await pay(token)).status).toBe(403);
  expect((await pay(undefined, cookie)).status).toBe(403);
  await db.insert(rolePermission).values(original);
  expect((await pay(token)).status).toBe(200);
  expect(await db.select({ id: cashTransaction.id }).from(cashTransaction)).toEqual(beforeLedger);
  console.log("HTTP bearer permission checks passed");
} finally {
  await db.insert(rolePermission).values(original).onConflictDoNothing();
  await server.stop(true);
  await pool.end();
}
