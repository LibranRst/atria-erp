import { beforeAll, beforeEach, afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  role,
  rolePermission,
  user,
  attachment,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  stockMovement,
  account,
  session,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import {
  prepareOwnProfile,
  ownProfileContext,
} from "@backend/server/usecases/ai/own-profile-context";
import { updateOwnProfileUseCase } from "@backend/server/usecases/profile/update-own-profile";
import { getAiOwnProfileProposal, confirmAiOwnProfileProposal } from "./own-profile";
import type { OwnProfileInput } from "@atria/core/ai/own-profile";
const authApi = auth.api as unknown as { getSession: unknown },
  originalSession = authApi.getSession,
  originalFetch = globalThis.fetch;
let actor: Actor,
  photoId: string,
  bytes: Buffer,
  uploads = 0,
  deletes = 0,
  failUpload = false,
  invalidImage = false,
  invalidAvatarUrl = false;
const images = new Map<string, Buffer>();
const endpoint = "https://ik.imagekit.io/atria-profile-integration";
const read = withTestRequest(getAiOwnProfileProposal),
  confirm = withTestRequest(confirmAiOwnProfileProposal);
async function proof(
  input: OwnProfileInput,
): Promise<{ identity: { conversationId: string; toolCallId: string }; messageId: string }> {
  const proposal = await prepareOwnProfile(actor, input),
    [c] = await db
      .insert(aiConversation)
      .values({ userId: actor.userId, title: "Own profile QA" })
      .returning(),
    toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeOwnProfile",
          toolCallId,
          state: "output-available",
          input,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { identity: { conversationId: c.id, toolCallId }, messageId: m.id };
}
async function protectedState(): Promise<string> {
  const current = await db.query.user.findFirst({ where: eq(user.id, actor.userId) });
  if (!current) throw new Error("user");
  return JSON.stringify([
    current.id,
    current.email,
    current.emailVerified,
    current.roleId,
    current.isActive,
    current.mustChangePassword,
    await db.select().from(rolePermission).where(eq(rolePermission.roleId, actor.roleId)),
    await db.select().from(account).where(eq(account.userId, actor.userId)),
    await db.select().from(session).where(eq(session.userId, actor.userId)),
    await db.select({ n: count() }).from(cashTransaction),
    await db.select({ n: count() }).from(stockMovement),
  ]);
}
describeIntegration("Owned profile preview and explicit save", () => {
  const env = {
    key: process.env.IMAGEKIT_PRIVATE_KEY,
    endpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    publicEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
  };
  beforeAll(async () => {
    process.env.IMAGEKIT_PRIVATE_KEY = "profile-test-key";
    process.env.IMAGEKIT_URL_ENDPOINT = endpoint;
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = endpoint;
    bytes = await sharp({
      create: { width: 96, height: 64, channels: 3, background: { r: 55, g: 65, b: 80 } },
    })
      .png()
      .toBuffer();
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url === "https://upload.imagekit.io/api/v1/files/upload") {
          uploads++;
          if (failUpload) return new Response("provider unavailable", { status: 503 });
          if (!(init?.body instanceof FormData)) throw new Error("form");
          expect(init.body.get("isPrivateFile")).toBe("false");
          const file = init.body.get("file");
          if (!(file instanceof Blob)) throw new Error("image");
          const image = Buffer.from(await file.arrayBuffer()),
            meta = await sharp(image).metadata();
          expect([meta.width, meta.height, meta.format]).toEqual([512, 512, "jpeg"]);
          expect(meta.exif).toBeUndefined();
          const id = randomUUID(),
            url = `${endpoint}/user-avatars/${invalidAvatarUrl ? "x".repeat(2200) : id}.jpg`;
          images.set(url, image);
          return Response.json({ fileId: id, url });
        }
        if (url.startsWith("https://api.imagekit.io/v1/files/")) {
          deletes++;
          return new Response(null, { status: 204 });
        }
        if (url.startsWith(endpoint + "/")) {
          const u = new URL(url),
            data = images.get(u.origin + u.pathname);
          return data
            ? new Response(invalidImage ? new Uint8Array([1, 2, 3]) : new Uint8Array(data), {
                headers: { "content-length": String(data.length) },
              })
            : new Response(null, { status: 404 });
        }
        throw new Error("External request forbidden in integration fixture");
      },
      { preconnect: originalFetch.preconnect },
    );
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: "QA", slug: "qa-profile" })
      .onConflictDoNothing();
  });
  beforeEach(async () => {
    uploads = 0;
    deletes = 0;
    failUpload = false;
    invalidImage = false;
    invalidAvatarUrl = false;
    const [r] = await db
      .insert(role)
      .values({ name: `PROFILE_${randomUUID().slice(0, 12)}`, dataScope: "NONE" })
      .returning();
    await db.insert(rolePermission).values({ roleId: r.id, permissionKey: "use:ai_chat" });
    const [u] = await db
      .insert(user)
      .values({
        name: "Nama lama",
        email: `${randomUUID()}@fixture.invalid`,
        roleId: r.id,
        image: null,
      })
      .returning();
    authApi.getSession = async () => ({ user: u, session: { id: "test", userId: u.id } });
    const a = await withTestRequest(resolveActor)();
    if (!a) throw new Error("actor");
    actor = a;
    const url = `${endpoint}/source-${randomUUID()}.png`;
    images.set(url, bytes);
    const [p] = await db
      .insert(attachment)
      .values({
        uploadedById: u.id,
        fileName: "foto-pilihan.png",
        fileUrl: url,
        storageFileId: randomUUID(),
        fileSize: bytes.length,
        mimeType: "image/png",
        referenceType: "private_ai_chat",
        referenceId: u.id,
      })
      .returning();
    photoId = p.id;
  });
  afterAll(() => {
    authApi.getSession = originalSession;
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      IMAGEKIT_PRIVATE_KEY: env.key,
      IMAGEKIT_URL_ENDPOINT: env.endpoint,
      NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: env.publicEndpoint,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  test("NONE role can preview name-only changes without admin grants; read never writes or uploads", async () => {
    const state = await protectedState(),
      id = await proof({ name: "Nama baru", photo: { action: "KEEP" } }),
      n = (await db.select({ n: count() }).from(auditLog))[0].n;
    const view = await read(id.identity);
    expect(view.success && view.data.status).toBe("READY");
    expect(uploads).toBe(0);
    expect((await db.select({ n: count() }).from(auditLog))[0].n).toBe(n);
    const saved = await confirm(id.identity);
    expect(saved.success).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.name).toBe(
      "Nama baru",
    );
    expect(await protectedState()).toBe(state);
    const result = await read(id.identity);
    expect(result.success && result.data.verified).toBe(true);
    expect(result.success && result.data.status).toBe("CONFIRMED");
  });
  test("add/replace copies selected owned image only after Save; original remains private", async () => {
    const state = await protectedState(),
      id = await proof({ name: "Foto baru", photo: { action: "REPLACE", attachmentId: photoId } });
    expect(uploads).toBe(0);
    expect((await confirm(id.identity)).success).toBe(true);
    expect(uploads).toBe(1);
    expect(
      (await db.query.attachment.findFirst({ where: eq(attachment.id, photoId) }))?.referenceType,
    ).toBe("private_ai_chat");
    const current = await db.query.user.findFirst({ where: eq(user.id, actor.userId) });
    expect(current?.image?.startsWith(endpoint + "/user-avatars/")).toBe(true);
    expect(await protectedState()).toBe(state);
    const next = await proof({ photo: { action: "REPLACE", attachmentId: photoId } });
    expect((await confirm(next.identity)).success).toBe(true);
    expect(uploads).toBe(2);
    const originalView = await read(id.identity);
    expect(originalView.success && originalView.data.saved?.imageUrl).toBe(current?.image);
    expect(originalView.success && originalView.data.verified).toBe(false);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.image).not.toBe(
      current?.image,
    );
  });
  test("remove uses initials, keeps name/security and never deletes the existing public photo", async () => {
    await updateOwnProfileUseCase(actor, { name: actor.name, imageUrl: `${endpoint}/old.jpg` });
    const state = await protectedState(),
      id = await proof({ photo: { action: "REMOVE" } });
    expect((await confirm(id.identity)).success).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.image).toBeNull();
    expect(uploads).toBe(0);
    expect(deletes).toBe(0);
    expect(await protectedState()).toBe(state);
  });
  test("concurrent photo approval uploads once and writes one receipt/audit", async () => {
    const id = await proof({ photo: { action: "REPLACE", attachmentId: photoId } }),
      results = await Promise.all([confirm(id.identity), confirm(id.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    expect(uploads).toBe(1);
    expect(
      (
        await db
          .select({ n: count() })
          .from(aiProposalConfirmation)
          .where(eq(aiProposalConfirmation.toolCallId, id.identity.toolCallId))
      )[0].n,
    ).toBe(1);
    expect(
      (
        await db
          .select({ n: count() })
          .from(auditLog)
          .where(
            and(eq(auditLog.targetId, actor.userId), eq(auditLog.action, "UPDATE_OWN_PROFILE")),
          )
      )[0].n,
    ).toBe(1);
  });
  test("no-op never creates audit or receipt", async () => {
    const id = await proof({ name: actor.name, photo: { action: "KEEP" } });
    const view = await read(id.identity);
    expect(view.success && view.data.proposal.changedFields.length).toBe(0);
    expect((await confirm(id.identity)).success).toBe(false);
    expect(
      (await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, actor.userId)))[0]
        .n,
    ).toBe(0);
  });
  test("stale user and expired proposal cannot save", async () => {
    const id = await proof({ name: "Nama usulan", photo: { action: "KEEP" } });
    await db.update(user).set({ name: "Perubahan manual" }).where(eq(user.id, actor.userId));
    const view = await read(id.identity);
    expect(view.success && view.data.status).toBe("STALE");
    expect((await confirm(id.identity)).success).toBe(false);
    const expired = await proof({ name: "Nama berikutnya", photo: { action: "KEEP" } });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    const old = await read(expired.identity);
    expect(old.success && old.data.status).toBe("EXPIRED");
    expect((await confirm(expired.identity)).success).toBe(false);
  });
  test("identity/ownership, inactive and revoked-access paths are blocked", async () => {
    const id = await proof({ name: "Nama baru", photo: { action: "KEEP" } });
    expect((await confirm({ ...id.identity, userId: randomUUID() })).success).toBe(false);
    expect(
      (await read({ conversationId: randomUUID(), toolCallId: id.identity.toolCallId })).success,
    ).toBe(false);
    await db.update(user).set({ isActive: false }).where(eq(user.id, actor.userId));
    expect((await confirm(id.identity)).success).toBe(false);
    await db.update(user).set({ isActive: true }).where(eq(user.id, actor.userId));
    await db.delete(rolePermission).where(eq(rolePermission.roleId, actor.roleId));
    expect((await read(id.identity)).success).toBe(false);
  });
  test("foreign owner/tenant/wrong purpose/non-image/oversized sources cannot be selected", async () => {
    const [other] = await db
      .insert(user)
      .values({ name: "Other", email: `${randomUUID()}@fixture.invalid`, roleId: actor.roleId })
      .returning();
    await db.update(attachment).set({ uploadedById: other.id }).where(eq(attachment.id, photoId));
    await expect(
      prepareOwnProfile(actor, { photo: { action: "REPLACE", attachmentId: photoId } }),
    ).rejects.toThrow();
    await db
      .update(attachment)
      .set({ uploadedById: actor.userId, referenceType: "private_expense" })
      .where(eq(attachment.id, photoId));
    await expect(
      prepareOwnProfile(actor, { photo: { action: "REPLACE", attachmentId: photoId } }),
    ).rejects.toThrow();
    await db
      .update(attachment)
      .set({ referenceType: "private_ai_chat", mimeType: "application/pdf" })
      .where(eq(attachment.id, photoId));
    await expect(
      prepareOwnProfile(actor, { photo: { action: "REPLACE", attachmentId: photoId } }),
    ).rejects.toThrow();
    await db
      .update(attachment)
      .set({ mimeType: "image/png", fileSize: 9 * 1024 * 1024 })
      .where(eq(attachment.id, photoId));
    await expect(
      prepareOwnProfile(actor, { photo: { action: "REPLACE", attachmentId: photoId } }),
    ).rejects.toThrow();
    const [t] = await db.insert(tenant).values({ name: "Foreign", slug: randomUUID() }).returning();
    await db
      .update(attachment)
      .set({ fileSize: bytes.length, tenantId: t.id })
      .where(eq(attachment.id, photoId));
    await expect(
      prepareOwnProfile(actor, { photo: { action: "REPLACE", attachmentId: photoId } }),
    ).rejects.toThrow();
  });
  test("storage and decoder failure roll back name/photo/audit/receipt; retry can succeed", async () => {
    const id = await proof({
      name: "Simpan bersama foto",
      photo: { action: "REPLACE", attachmentId: photoId },
    });
    failUpload = true;
    expect((await confirm(id.identity)).success).toBe(false);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.name).toBe(
      actor.name,
    );
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, id.identity.toolCallId),
      }),
    ).toBeUndefined();
    failUpload = false;
    invalidImage = true;
    expect((await confirm(id.identity)).success).toBe(false);
    invalidImage = false;
    expect((await confirm(id.identity)).success).toBe(true);
  });
  test("a failure after avatar upload rolls back the database and cleans the uncommitted copy", async () => {
    const id = await proof({
      name: "Nama bersama foto",
      photo: { action: "REPLACE", attachmentId: photoId },
    });
    invalidAvatarUrl = true;
    expect((await confirm(id.identity)).success).toBe(false);
    expect(uploads).toBe(1);
    expect(deletes).toBe(1);
    const current = await db.query.user.findFirst({ where: eq(user.id, actor.userId) });
    expect(current?.name).toBe(actor.name);
    expect(current?.image).toBeNull();
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, id.identity.toolCallId),
      }),
    ).toBeUndefined();
  });
  test("manual writer preserves omitted photo and has the same no-op/audit semantics", async () => {
    const imageUrl = `${endpoint}/old.jpg`;
    await updateOwnProfileUseCase(actor, { name: actor.name, imageUrl });
    const result = await updateOwnProfileUseCase(actor, { name: "Manual" });
    expect(result.success && result.data.updated).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.image).toBe(
      imageUrl,
    );
    const n = (
      await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, actor.userId))
    )[0].n;
    expect((await updateOwnProfileUseCase(actor, { name: "Manual" })).success).toBe(true);
    expect(
      (await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, actor.userId)))[0]
        .n,
    ).toBe(n);
  });
  test("verified history reports a later change; replay does not overwrite it", async () => {
    const id = await proof({ name: "Nama tersimpan", photo: { action: "KEEP" } });
    expect((await confirm(id.identity)).success).toBe(true);
    await updateOwnProfileUseCase(actor, { name: "Nama setelahnya" });
    const view = await read(id.identity);
    expect(view.success && view.data.status).toBe("CONFIRMED");
    expect(view.success && view.data.verified).toBe(false);
    expect((await confirm(id.identity)).success).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, actor.userId) }))?.name).toBe(
      "Nama setelahnya",
    );
  });
  test("photo choices are bounded and ambiguous choices require a human selection", async () => {
    const result = await ownProfileContext(actor, { photoQuery: "f", offset: 0 });
    expect(result.photos).toHaveLength(1);
    expect(result.needsPhotoChoice).toBe(true);
    expect(
      (await ownProfileContext(actor, { photoQuery: "foto-pilihan", offset: 0 })).needsPhotoChoice,
    ).toBe(false);
  });
});
