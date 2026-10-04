import { PGlite } from "@electric-sql/pglite";
import { expect, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { PRIVATE_ATTACHMENT_MAX_BYTES, type PrivateAttachmentPurpose } from "@atria/core/media/private-attachment";

const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
const pmRoleId = crypto.randomUUID();
const financeRoleId = crypto.randomUUID();
const aliceId = crypto.randomUUID();
const bobId = crypto.randomUUID();
const financeId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const foreignProjectId = crypto.randomUUID();
const clientId = crypto.randomUUID();
let sessionUserId = aliceId;
let sessionRoleId = pmRoleId;
mock.module("@backend/lib/server/session", () => ({
  getServerSession: async (): Promise<unknown> => ({ user: { id: sessionUserId, roleId: sessionRoleId, isActive: true, name: "Fixture", email: "fixture@example.invalid" }, session: { id: "fixture" } }),
  getSessionFromHeaders: async (): Promise<unknown> => ({ user: { id: sessionUserId, roleId: sessionRoleId, isActive: true, name: "Fixture", email: "fixture@example.invalid" }, session: { id: "fixture" } }),
}));
await database.insert(schema.tenant).values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable" });
await database.insert(schema.role).values([
  { id: pmRoleId, name: "FIXTURE_PM", dataScope: "ASSIGNED" },
  { id: financeRoleId, name: "FIXTURE_FINANCE", dataScope: "GLOBAL" },
]);
await database.insert(schema.rolePermission).values([
  { roleId: pmRoleId, permissionKey: "create:cost" }, { roleId: pmRoleId, permissionKey: "view:cost" }, { roleId: pmRoleId, permissionKey: "use:ai_chat" },
  { roleId: financeRoleId, permissionKey: "view:cost" }, { roleId: financeRoleId, permissionKey: "reconcile:ledger" }, { roleId: financeRoleId, permissionKey: "use:ai_chat" },
]);
await database.insert(schema.user).values([
  { id: aliceId, name: "Alice", email: "alice@example.invalid", roleId: pmRoleId },
  { id: bobId, name: "Bob", email: "bob@example.invalid", roleId: pmRoleId },
  { id: financeId, name: "Finance", email: "finance@example.invalid", roleId: financeRoleId },
]);
await database.insert(schema.client).values({ id: clientId, name: "Fixture", email: "client@example.invalid", phone: "-" });
await database.insert(schema.project).values([
  { id: projectId, clientId, projectManagerId: aliceId, name: "Alice project", status: "ACTIVE", totalContractValue: "1000000.00" },
  { id: foreignProjectId, clientId, projectManagerId: bobId, name: "Bob project", status: "ACTIVE", totalContractValue: "1000000.00" },
]);
// Actual 1x1 JPEG; no provider requests are sent by this fixture.
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCvRRRQB//Z", "base64");
type ReadMode = "valid" | "redirect" | "oversize" | "invalid";
let readMode: ReadMode = "valid";
let fetchCalls = 0;
let uploadCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
  fetchCalls += 1;
  const url = input instanceof Request ? input.url : String(input);
  expect(init?.redirect).toBe("error");
  if (url === "https://upload.imagekit.io/api/v1/files/upload") {
    uploadCalls += 1;
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    if (!(init?.body instanceof FormData)) throw new Error("Upload FormData missing");
    expect(init.body.get("isPrivateFile")).toBe("true");
    expect(String(init.body.get("folder"))).toContain(`/atria-private/`);
    return Response.json({ fileId: `provider-fixture-${uploadCalls}`, url: `https://ik.imagekit.io/disposable/proof-${uploadCalls}.jpg` });
  }
  if (!url.startsWith("https://ik.imagekit.io/disposable/")) throw new Error("Unexpected network destination in fixture");
  expect(new URL(url).searchParams.has("ik-s")).toBe(true);
  if (readMode === "redirect") return new Response(null, { status: 302, headers: { location: "https://foreign.invalid/proof.jpg" } });
  if (readMode === "oversize") return new Response(jpeg, { headers: { "content-length": String(PRIVATE_ATTACHMENT_MAX_BYTES + 1) } });
  if (readMode === "invalid") return new Response(new Uint8Array([0, 1, 2]), { headers: { "content-type": "image/jpeg" } });
  return new Response(jpeg, { headers: { "content-type": "image/jpeg", "content-length": String(jpeg.length) } });
}, { preconnect: originalFetch.preconnect });
const { uploadPrivateAttachment, readPrivateAttachment, authorizedPrivateAttachment } = await import("@backend/server/usecases/media/private-attachments");
const { resolveActor } = await import("@backend/server/actor");
async function actor(): Promise<Actor> {
  const resolved = await resolveActor();
  if (!resolved) throw new Error("Fixture actor missing");
  return resolved;
}
function form(purpose: PrivateAttachmentPurpose, selectedProjectId?: string, bytes: Uint8Array = jpeg): FormData {
  const data = new FormData();
  data.set("purpose", purpose);
  if (selectedProjectId) data.set("projectId", selectedProjectId);
  data.set("file", new File([new Uint8Array(bytes)], "proof.jpg", { type: "image/jpeg" }));
  return data;
}
const alice = await actor();
const proof = await uploadPrivateAttachment(alice, form("expense", projectId));
expect(proof.url).toBe(`https://atria.test/api/media/attachments/${proof.fileId}`);
expect(proof.fileId).not.toContain("provider-fixture");
expect(JSON.stringify(proof)).not.toContain("ik.imagekit.io");
expect(JSON.stringify(proof)).not.toContain("ik-s");
const stored = await database.query.attachment.findFirst({ where: eq(schema.attachment.id, proof.fileId) });
expect(stored).toMatchObject({ uploadedById: aliceId, referenceId: projectId, referenceType: "private_expense", storageFileId: "provider-fixture-1" });
expect((await database.select().from(schema.auditLog)).length).toBe(1);
const read = await readPrivateAttachment(alice, proof.url, "expense");
expect(read.bytes.equals(jpeg)).toBe(true);
expect(Object.keys(read).sort()).toEqual(["bytes", "row"]);
let previousCalls = fetchCalls;
await expect(uploadPrivateAttachment(alice, form("expense", foreignProjectId))).rejects.toThrow("Akses proyek ditolak");
expect(fetchCalls).toBe(previousCalls);
await expect(authorizedPrivateAttachment(alice, proof.url, "ai_chat")).rejects.toThrow("akses ditolak");
expect(fetchCalls).toBe(previousCalls);
sessionUserId = bobId;
const bob = await actor();
await expect(readPrivateAttachment(bob, proof.url, "expense")).rejects.toThrow("Akses proyek ditolak");
expect(fetchCalls).toBe(previousCalls);
sessionUserId = financeId; sessionRoleId = financeRoleId;
const finance = await actor();
expect((await readPrivateAttachment(finance, proof.url, "expense")).bytes.equals(jpeg)).toBe(true);
const statement = await uploadPrivateAttachment(finance, form("bank_statement"));
await expect(readPrivateAttachment(bob, statement.url, "bank_statement")).rejects.toThrow("akses ditolak");
sessionUserId = aliceId; sessionRoleId = pmRoleId;
const chat = await uploadPrivateAttachment(await actor(), form("ai_chat"));
expect((await readPrivateAttachment(await actor(), chat.url, "ai_chat")).bytes.equals(jpeg)).toBe(true);
previousCalls = fetchCalls;
await expect(readPrivateAttachment(bob, chat.url, "ai_chat")).rejects.toThrow("akses ditolak");
await expect(readPrivateAttachment(finance, chat.url, "ai_chat")).rejects.toThrow("akses ditolak");
expect(fetchCalls).toBe(previousCalls);
await database.delete(schema.rolePermission).where(and(eq(schema.rolePermission.roleId, pmRoleId), inArray(schema.rolePermission.permissionKey, ["create:cost", "view:cost"])));
const revoked = await actor();
await expect(readPrivateAttachment(revoked, proof.url, "expense")).rejects.toThrow("akses ditolak");
await expect(uploadPrivateAttachment(revoked, form("expense", projectId))).rejects.toThrow("Akses unggah lampiran ditolak");
expect(fetchCalls).toBe(previousCalls);
await database.insert(schema.rolePermission).values([{ roleId: pmRoleId, permissionKey: "create:cost" }, { roleId: pmRoleId, permissionKey: "view:cost" }]);
const restored = await actor();
await expect(readPrivateAttachment(restored, "https://foreign.invalid/api/media/attachments/" + proof.fileId)).rejects.toThrow("Referensi lampiran tidak diizinkan");
await expect(uploadPrivateAttachment(restored, form("expense", projectId, new Uint8Array([0, 1, 2])))).rejects.toThrow("Isi berkas tidak sesuai");
await expect(uploadPrivateAttachment(restored, form("expense", projectId, new Uint8Array(PRIVATE_ATTACHMENT_MAX_BYTES + 1)))).rejects.toThrow("10 MB");
expect(fetchCalls).toBe(previousCalls);
for (const mode of ["redirect", "oversize", "invalid"] satisfies readonly ReadMode[]) {
  readMode = mode;
  await expect(readPrivateAttachment(restored, proof.url, "expense")).rejects.toThrow();
}
readMode = "valid";
const foreignTenantId = crypto.randomUUID();
const foreignAttachmentId = crypto.randomUUID();
await database.insert(schema.tenant).values({ id: foreignTenantId, name: "Foreign", slug: "foreign" });
await database.insert(schema.attachment).values({ id: foreignAttachmentId, tenantId: foreignTenantId, uploadedById: aliceId, referenceId: projectId, referenceType: "private_expense", fileName: "foreign.jpg", fileUrl: "https://ik.imagekit.io/disposable/foreign.jpg", mimeType: "image/jpeg", fileSize: jpeg.length, storageFileId: "foreign-fixture" });
previousCalls = fetchCalls;
await expect(readPrivateAttachment(restored, `https://atria.test/api/media/attachments/${foreignAttachmentId}`, "expense")).rejects.toThrow("akses ditolak");
expect(fetchCalls).toBe(previousCalls);
globalThis.fetch = originalFetch;
await postgres.close();
console.log("Private attachment business checks passed");
