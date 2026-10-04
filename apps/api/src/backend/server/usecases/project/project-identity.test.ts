import { describe, expect, test } from "bun:test";
import { projectFormBootstrapSchema } from "@atria/core/validations/project";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

const ORIGINAL_CREATE_TRANSACTION = `
    const result = await db.transaction(async (tx) => {
      // 1. Create client if it's new
      if (!finalClientId) {
        if (!data.newClientName) {
          throw new Error("Nama klien baru harus diisi jika tidak memilih klien terdaftar.");
        }
        const [newClient] = await tx
          .insert(client)
          .values({
            id: crypto.randomUUID(),
            name: data.newClientName,
            companyName: "",
            email:
              data.newClientEmail ||
              \`\${data.newClientName.toLowerCase().replace(/\\s+/g, "")}@example.com\`,
            phone: data.newClientPhone || "-",
            address: data.newClientAddress || "-",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        finalClientId = newClient.id;
      }

      // 2. Insert project
      const [newProject] = await tx
        .insert(project)
        .values({
          id: crypto.randomUUID(),
          name: data.name,
          clientId: finalClientId,
          projectManagerId: data.projectManagerId,
          status: "DRAFT",
          financialHealth: "HEALTHY",
          totalContractValue: data.totalContractValue.toFixed(2),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location || null,
          roomArea: data.roomArea || null,
          projectType: data.projectType || null,
          coverImageUrl: data.coverImageUrl || null,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const newBudget = await insertCanonicalProjectBudgetTx({
        tx,
        projectId: newProject.id,
        contractValue: Number(newProject.totalContractValue),
        approvedRabValue: Number(newProject.totalContractValue),
        allocation: allocationDefault,
        notes: "Inisialisasi anggaran kategori otomatis dari pengaturan sistem.",
      });

      // 3. Write audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        action: "CREATE_PROJECT",
        targetTable: "project",
        targetId: newProject.id,
        newState: JSON.stringify({ project: newProject, canonicalBudgetId: newBudget.id }),
        createdAt: new Date(),
      });

      return newProject;
    });
`;

const ORIGINAL_UPDATE_TRANSACTION = `
    await db.transaction(async (tx) => {
      const existing = await tx.query.project.findFirst({
        where: eq(project.id, data.id),
      });

      if (!existing) {
        throw new Error("Proyek tidak ditemukan.");
      }
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        throw new Error("Proyek yang sudah selesai atau dibatalkan tidak dapat diedit langsung.");
      }
      if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
        throw new Error(
          "Status COMPLETED hanya dapat ditetapkan melalui Project Closing Checklist.",
        );
      }

      // 1. Update project details
      await tx
        .update(project)
        .set({
          name: data.name,
          clientId: data.clientId,
          projectManagerId: data.projectManagerId,
          status: data.status,
          financialHealth: data.financialHealth,
          totalContractValue:
            data.totalContractValue !== undefined
              ? data.totalContractValue.toFixed(2)
              : existing.totalContractValue,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location || null,
          roomArea: data.roomArea || null,
          projectType: data.projectType || null,
          coverImageUrl: data.coverImageUrl || null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(project.id, data.id));

      // 2. If contract value changed, sync with draft budget if available
      const currentBudget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, data.id),
      });

      if (
        data.totalContractValue !== undefined &&
        currentBudget &&
        currentBudget.status === "DRAFT"
      ) {
        const ratio = Number(currentBudget.budgetCapRatio);
        const internalBudget = data.totalContractValue * ratio;
        const targetGrossAmount = data.totalContractValue - internalBudget;

        await tx
          .update(projectBudgets)
          .set({
            contractValue: data.totalContractValue.toFixed(2),
            internalBudget: internalBudget.toFixed(2),
            targetGrossAmount: targetGrossAmount.toFixed(2),
            targetGrossPercentage:
              data.totalContractValue > 0
                ? ((targetGrossAmount / data.totalContractValue) * 100).toFixed(4)
                : "0.0000",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, currentBudget.id));
      }

      // 3. Write audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        action: "UPDATE_PROJECT",
        targetTable: "project",
        targetId: data.id,
        newState: JSON.stringify(data),
        createdAt: new Date(),
      });
    });
`;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTransactionStatement(source: string, assignment: boolean): string {
  const marker = assignment ? "const result = await db.transaction(" : "await db.transaction(";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);

  let depth = 0;
  let index = source.indexOf("(", start);
  for (; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, source.indexOf(";", index) + 1);
}

describe("project identity use-case contract", () => {
  const createSource = readFileSync(
    path.join(APP_ROOT, "server/usecases/project/create-project.ts"),
    "utf8",
  );
  const updateSource = readFileSync(
    path.join(APP_ROOT, "server/usecases/project/update-project.ts"),
    "utf8",
  );
  const creationWriteSource = readFileSync(
    path.join(APP_ROOT, "server/usecases/project/project-creation-write.ts"),
    "utf8",
  );
  const actionSource = readFileSync(path.join(APP_ROOT, "app/actions/project/crud.ts"), "utf8");
  const routerSource = readFileSync(path.join(APP_ROOT, "server/trpc/routers/project.ts"), "utf8");
  const bootstrapSource = readFileSync(
    path.join(APP_ROOT, "server/usecases/project/project-form-bootstrap.ts"),
    "utf8",
  );

  test("transaksi create mempertahankan kontrak lama melalui helper bersama", () => {
    const legacy = normalize(ORIGINAL_CREATE_TRANSACTION);
    expect(legacy).toContain("insertCanonicalProjectBudgetTx");
    expect(createSource).toContain("insertProjectWithCanonicalBudgetTx");
    expect(creationWriteSource).toContain("insert(client)");
    expect(creationWriteSource).toContain("insert(project)");
    expect(creationWriteSource).toContain("insertCanonicalProjectBudgetTx");
    expect(creationWriteSource).toContain('status: "DRAFT"');
  });

  test("transaksi update identik dengan action lama setelah substitusi actor", () => {
    const expected = normalize(ORIGINAL_UPDATE_TRANSACTION).replaceAll(
      "currentUser.id",
      "actor.userId",
    );
    expect(normalize(extractTransactionStatement(updateSource, false))).toBe(expected);
  });

  test("Server Action menjadi wrapper actor yang tipis", () => {
    expect(actionSource).toContain("resolveActor()");
    expect(actionSource).toContain("createProjectUseCase(actor, input)");
    expect(actionSource).toContain("updateProjectUseCase(actor, input)");
    expect(actionSource).not.toContain("db.transaction");
    expect(actionSource).not.toContain('from "@backend/db"');
  });

  test("kedua use-case menerima Actor eksplisit dan update menegakkan scope", () => {
    expect(createSource).toMatch(/createProjectUseCase\(\s*actor: Actor,/);
    expect(updateSource).toMatch(/updateProjectUseCase\(\s*actor: Actor,/);
    expect(updateSource).toContain('actorCan(actor, "update:budget")');
    expect(updateSource).toContain("assertProjectAccess(data.id, actor.userId, actor.roleName)");
  });

  test("router project memakai activeProcedure dan mendelegasikan use-case", () => {
    expect(routerSource.match(/activeProcedure/g)).toHaveLength(4);
    expect(routerSource).toContain("getProjectFormBootstrap(ctx.actor!, input)");
    expect(routerSource).toContain("createProjectUseCase(ctx.actor!, input)");
    expect(routerSource).toContain("updateProjectIdentitySchema");
    expect(routerSource).toContain("getProjectFormBootstrap(ctx.actor!, { projectId: input.id })");
    expect(routerSource).toContain("updateProjectUseCase(ctx.actor!, {");
    expect(routerSource).toContain("financialHealth: bootstrap.project.financialHealth");
    expect(routerSource).toContain("status: bootstrap.project.status");
    expect(routerSource).not.toContain('from "@backend/db"');
  });

  test("bootstrap hanya memuat identitas dan opsi form", () => {
    expect(bootstrapSource).toContain("assertProjectAccess(input.projectId");
    expect(bootstrapSource).not.toContain("canonicalBudgets");
    expect(bootstrapSource).not.toContain("projectExpenses");
    expect(bootstrapSource).not.toContain("stockMovements");
  });

  test("bootstrap menerima ID proyek seed lama tetapi menolak ID kosong", () => {
    expect(
      projectFormBootstrapSchema.parse({
        projectId: "77777777-7777-7777-7777-777777777772",
      }),
    ).toEqual({ projectId: "77777777-7777-7777-7777-777777777772" });
    expect(projectFormBootstrapSchema.safeParse({ projectId: "" }).success).toBe(false);
  });
});
