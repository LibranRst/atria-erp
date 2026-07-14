import { db } from "@/db";
import { project, rabEstimate, rabEstimateItem, projectBudgets, projectBudgetCategory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createProjectAction } from "@/app/actions/project/crud";
import { approveRabEstimate } from "@/app/actions/project/rap-rab";
import { describe, it, expect, mock, afterAll } from "bun:test";

// Mock next/headers for Next.js environment
mock.module("next/headers", () => {
  return {
    cookies: () => {
      return {
        toString: () => "mocked-cookies",
      };
    },
  };
});

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

function mockUserSession(user: { id: string; roleId: string; email: string; name: string } | null) {
  const mockFn = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: user.id,
        roleId: user.roleId,
        email: user.email,
        name: user.name,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };
  (auth.api as unknown as { getSession: unknown }).getSession = mockFn;
}

function restoreUserSession() {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

const OWNER_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

describe("Project Workflow Rework - creation and RAB auto-scale", () => {
  afterAll(() => {
    restoreUserSession();
  });

  it("should create project with contract value 0.00 and initialize 0.00 budget category allocations", async () => {
    mockUserSession(OWNER_USER);

    // Get an existing client to bind the project to
    const existingClient = await db.query.client.findFirst();
    if (!existingClient) {
      throw new Error("Seed clients not found in test db");
    }

    const newProjectName = "Project Rework Test - " + Math.random().toString(36).substring(7);

    // Call server action without contract value
    const res = await createProjectAction({
      name: newProjectName,
      clientId: existingClient.id,
      projectManagerId: "33333333-3333-3333-3333-333333333331", // PM Budi
      status: "DRAFT",
    });

    expect(res.success).toBe(true);
    if (!res.success) return;

    const projectId = res.data.id;

    // Verify project record has contract value 0.00
    const proj = await db.query.project.findFirst({
      where: eq(project.id, projectId),
    });
    expect(proj).toBeDefined();
    expect(Number(proj?.totalContractValue)).toBe(0);

    // Verify budget record is created with 0 contract value
    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, projectId),
      with: {
        categories: true,
      },
    });

    expect(budget).toBeDefined();
    expect(Number(budget?.contractValue)).toBe(0);
    expect(Number(budget?.internalBudget)).toBe(0);

    // Verify category allocations are initialized to 0.00
    if (budget) {
      for (const cat of budget.categories) {
        expect(Number(cat.allocatedAmount)).toBe(0);
      }
    }

    // Clean up created project and its budget dependencies
    if (budget) {
      await db.delete(projectBudgetCategory).where(eq(projectBudgetCategory.projectBudgetId, budget.id));
      await db.delete(projectBudgets).where(eq(projectBudgets.id, budget.id));
    }
    await db.delete(project).where(eq(project.id, projectId));
  });

  it("should automatically update and scale category budget allocations when RAB estimate is approved", async () => {
    mockUserSession(OWNER_USER);

    const existingClient = await db.query.client.findFirst();
    if (!existingClient) {
      throw new Error("Seed clients not found in test db");
    }

    // 1. Create project with 0 contract value
    const projName = "Project RAB Auto-Scale Test - " + Math.random().toString(36).substring(7);
    const createRes = await createProjectAction({
      name: projName,
      clientId: existingClient.id,
      projectManagerId: "33333333-3333-3333-3333-333333333331",
      status: "DRAFT",
    });

    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const projectId = createRes.data.id;

    // Get the generated project budget ID
    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, projectId),
    });
    if (!budget) {
      throw new Error("Project budget failed to initialize");
    }

    // 2. Create a dummy RAB estimate with items
    const rabId = crypto.randomUUID();
    await db.insert(rabEstimate).values({
      id: rabId,
      projectId,
      title: "Test RAB",
      status: "DRAFT",
      approvedValue: "0.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(rabEstimateItem).values([
      {
        id: crypto.randomUUID(),
        rabEstimateId: rabId,
        clientLabel: "Item 1",
        description: "Desc 1",
        quantity: "2.00",
        unit: "unit",
        unitPrice: "50000000.00", // 50 million
        lineTotal: "100000000.00", // 100 million
        displayOrder: 1,
        isHidden: false,
      },
      {
        id: crypto.randomUUID(),
        rabEstimateId: rabId,
        clientLabel: "Item 2",
        description: "Desc 2",
        quantity: "1.00",
        unit: "unit",
        unitPrice: "50000000.00", // 50 million
        lineTotal: "50000000.00", // 50 million
        displayOrder: 2,
        isHidden: false,
      },
    ]);

    // 3. Approve the RAB Estimate
    const approveRes = await approveRabEstimate(rabId);

    expect(approveRes.success).toBe(true);

    // 4. Verify project contract value updated
    const updatedProj = await db.query.project.findFirst({
      where: eq(project.id, projectId),
    });
    expect(Number(updatedProj?.totalContractValue)).toBe(150000000); // 150 million

    // 5. Verify budget scaled correctly
    const updatedBudget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, projectId),
      with: {
        categories: {
          with: {
            expenseCategory: true,
          },
        },
      },
    });

    expect(updatedBudget).toBeDefined();
    if (updatedBudget) {
      expect(Number(updatedBudget.contractValue)).toBe(150000000);

      const ratio = Number(updatedBudget.budgetCapRatio);
      const expectedInternalBudget = 150000000 * ratio;
      expect(Number(updatedBudget.internalBudget)).toBe(expectedInternalBudget);

      // Category allocations should be scaled according to their default ratio and the new internalBudget
      for (const cat of updatedBudget.categories) {
        const catRatio = Number(cat.ratioPercentage);
        const expectedAllocatedAmount = expectedInternalBudget * catRatio;
        expect(Number(cat.allocatedAmount)).toBe(expectedAllocatedAmount);
        expect(Number(cat.remainingAmount)).toBe(expectedAllocatedAmount);
      }
    }

    // Clean up
    await db.delete(rabEstimateItem).where(eq(rabEstimateItem.rabEstimateId, rabId));
    await db.delete(rabEstimate).where(eq(rabEstimate.id, rabId));
    await db.delete(projectBudgetCategory).where(eq(projectBudgetCategory.projectBudgetId, budget.id));
    await db.delete(projectBudgets).where(eq(projectBudgets.id, budget.id));
    await db.delete(project).where(eq(project.id, projectId));
  });
});
