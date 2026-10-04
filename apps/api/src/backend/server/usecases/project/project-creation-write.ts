import { client, project } from "@backend/db/schema";
import { db } from "@backend/db";
import {
  insertCanonicalProjectBudgetTx,
  type BudgetAllocationInput,
} from "@backend/lib/budget/project-budget-creation";

type ProjectCreationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProjectCreationWriteInput = {
  readonly name: string;
  readonly clientId?: string | null;
  readonly newClientName?: string | null;
  readonly newClientEmail?: string | null;
  readonly newClientPhone?: string | null;
  readonly newClientAddress?: string | null;
  readonly projectManagerId: string | null;
  readonly totalContractValue: number;
  readonly approvedRabValue?: number;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly location?: string | null;
  readonly roomArea?: string | null;
  readonly projectType?: string | null;
  readonly coverImageUrl?: string | null;
  readonly notes?: string | null;
};

export async function insertProjectWithCanonicalBudgetTx(args: {
  readonly tx: ProjectCreationTx;
  readonly input: ProjectCreationWriteInput;
  readonly allocation: BudgetAllocationInput;
}): Promise<{
  readonly project: typeof project.$inferSelect;
  readonly budgetId: string;
}> {
  let finalClientId = args.input.clientId || null;
  if (!finalClientId) {
    const clientName = args.input.newClientName?.trim();
    if (!clientName) throw new Error("CLIENT_NAME_REQUIRED");
    const [newClient] = await args.tx
      .insert(client)
      .values({
        id: crypto.randomUUID(),
        name: clientName,
        companyName: "",
        email:
          args.input.newClientEmail?.trim() ||
          `${clientName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        phone: args.input.newClientPhone?.trim() || "-",
        address: args.input.newClientAddress?.trim() || "-",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    finalClientId = newClient.id;
  }

  const [newProject] = await args.tx
    .insert(project)
    .values({
      id: crypto.randomUUID(),
      name: args.input.name,
      clientId: finalClientId,
      projectManagerId: args.input.projectManagerId,
      status: "DRAFT",
      financialHealth: "HEALTHY",
      totalContractValue: args.input.totalContractValue.toFixed(2),
      startDate: args.input.startDate ? new Date(args.input.startDate) : null,
      endDate: args.input.endDate ? new Date(args.input.endDate) : null,
      location: args.input.location || null,
      roomArea: args.input.roomArea || null,
      projectType: args.input.projectType || null,
      coverImageUrl: args.input.coverImageUrl || null,
      notes: args.input.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const budget = await insertCanonicalProjectBudgetTx({
    tx: args.tx,
    projectId: newProject.id,
    contractValue: args.input.totalContractValue,
    approvedRabValue: args.input.approvedRabValue,
    allocation: args.allocation,
    notes: "Inisialisasi anggaran kategori otomatis dari pengaturan sistem.",
  });

  return { project: newProject, budgetId: budget.id };
}
