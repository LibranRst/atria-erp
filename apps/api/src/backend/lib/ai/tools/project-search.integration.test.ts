import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "@backend/db";
import { client, project, role, tenant, user } from "@backend/db/schema";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { buildProjectTools } from "./project-tools";
import { buildAiTools } from "./index";
let viewerId: string, ownId: string;
let initialMatchingCount: number, initialPortfolioCount: number;
describeIntegration("bounded single-character project lookup", () => {
  beforeAll(async () => {
    const baseline = buildProjectTools(aiToolContextForRole("OWNER")).listProjects;
    if (!baseline.execute) throw new Error("Execution missing");
    const matching = await baseline.execute(
      { query: "X", limit: 1 },
      { toolCallId: "baseline-search", messages: [], context: {} },
    );
    const portfolio = await baseline.execute(
      { limit: 1 },
      { toolCallId: "baseline-portfolio", messages: [], context: {} },
    );
    if (!matching || !("projects" in matching) || !portfolio || !("projects" in portfolio))
      throw new Error("Baseline project source missing");
    initialMatchingCount = matching.matchedCount;
    initialPortfolioCount = portfolio.matchedCount;
    const [r] = await db
      .insert(role)
      .values({ name: `SEARCH-${randomUUID().slice(0, 8)}`, dataScope: "ASSIGNED" })
      .returning();
    const [person] = await db
      .insert(user)
      .values({ name: "Pengguna Uji", email: `${randomUUID()}@fixture.invalid`, roleId: r.id })
      .returning();
    viewerId = person.id;
    const [c] = await db
      .insert(client)
      .values({
        name: `Klien Uji ${randomUUID()}`,
        email: `${randomUUID()}@fixture.invalid`,
        phone: "08123456789",
      })
      .returning();
    const [own] = await db
      .insert(project)
      .values({
        name: `X - milik pengguna ${randomUUID()}`,
        clientId: c.id,
        projectManagerId: viewerId,
        status: "DRAFT",
        totalContractValue: "0.00",
      })
      .returning();
    ownId = own.id;
    await db.insert(project).values(
      Array.from({ length: 25 }, (_, i) => ({
        name: `X - proyek lain ${i} ${randomUUID()}`,
        clientId: c.id,
        status: "DRAFT",
        totalContractValue: "0.00",
      })),
    );
    const foreignTenantId = randomUUID();
    await db
      .insert(tenant)
      .values({ id: foreignTenantId, name: "Tenant terpisah QA", slug: `foreign-${randomUUID()}` });
    const [foreignClient] = await db
      .insert(client)
      .values({
        tenantId: foreignTenantId,
        name: "Klien asing QA",
        email: `${randomUUID()}@fixture.invalid`,
        phone: "08123456789",
      })
      .returning();
    await db.insert(project).values({
      tenantId: foreignTenantId,
      name: "X - proyek tenant lain",
      clientId: foreignClient.id,
      projectManagerId: viewerId,
      status: "DRAFT",
      totalContractValue: "0.00",
    });
  });
  test("custom assigned scope returns only its assigned match and asks for explicit choice even for one row", async () => {
    const context = aiToolContextForRole("CUSTOM", {
      userId: viewerId,
      dataScope: "ASSIGNED",
      permissions: ["use:ai_chat", "view:project"],
    });
    const tool = buildProjectTools(context).listProjects;
    if (!tool.execute) throw new Error("Execution missing");
    const result = await tool.execute(
      { query: "X", limit: 20 },
      { toolCallId: "scope", messages: [], context: {} },
    );
    if (!result || !("projects" in result)) throw new Error("Project result missing");
    expect(result.projects.map((p) => p.projectId)).toEqual([ownId]);
    expect(result.requiresProjectChoice).toBe(true);
    expect(result.matchedCount).toBe(1);
    expect(result.hasMore).toBe(false);
  });
  test("global search keeps its20-row upper bound", async () => {
    const tool = buildProjectTools(aiToolContextForRole("OWNER")).listProjects;
    if (!tool.execute) throw new Error("Execution missing");
    const result = await tool.execute(
      { query: "X", limit: 20 },
      { toolCallId: "bounds", messages: [], context: {} },
    );
    if (!result || !("projects" in result)) throw new Error("Project result missing");
    expect(result.projects).toHaveLength(20);
    expect(result.requiresProjectChoice).toBe(true);
    expect(result.matchedCount).toBe(initialMatchingCount + 26);
    expect(result.hasMore).toBe(true);
  });
  test("portfolio totals include drafts and remain complete with a one-row preview", async () => {
    const tool = buildProjectTools(aiToolContextForRole("OWNER")).listProjects;
    if (!tool.execute) throw new Error("Execution missing");
    const result = await tool.execute(
      { limit: 1 },
      { toolCallId: "total", messages: [], context: {} },
    );
    if (!result || !("projects" in result)) throw new Error("Project result missing");
    expect(result.projects).toHaveLength(1);
    expect(result.matchedCount).toBe(initialPortfolioCount + 26);
    expect(result.hasMore).toBe(true);
  });
  test("NONE scope receives no project lookup capability even with matching grants", () => {
    expect(
      buildAiTools(
        aiToolContextForRole("CUSTOM", {
          userId: viewerId,
          dataScope: "NONE",
          permissions: ["use:ai_chat", "view:project"],
        }),
      ).listProjects,
    ).toBeUndefined();
  });
});
