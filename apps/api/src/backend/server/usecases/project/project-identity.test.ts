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

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

  test("manual update delegates identity/PM to locked shared writers and preserves contract guard", () => {
    expect(updateSource).toContain("prepareProjectManagementTx");
    expect(updateSource).toContain("writeProjectManagementTx");
    expect(updateSource).toContain('guardedBudget.status !== "DRAFT"');
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
    expect(updateSource).toContain("prepareProjectManagementTx(tx, actor");
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
