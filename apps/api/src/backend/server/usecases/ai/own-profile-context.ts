import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, isNotNull, gte, lte } from "drizzle-orm";
import { db } from "@backend/db";
import { attachment, rolePermission, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "../finance/mutation-access";
import { lockOwnProfileTx, OwnProfileError } from "../profile/update-own-profile";
import { authorizedPrivateAttachment } from "../media/private-attachments";
import { updateOwnProfileSchema } from "@atria/core/validations/profile";
import {
  ownProfileInputSchema,
  ownProfileProposalSchema,
  type OwnProfileInput,
  type OwnProfileProposal,
  type OwnProfileSnapshot,
} from "@atria/core/ai/own-profile";
export function ownProfileSnapshot(record: {
  readonly name: string;
  readonly image: string | null;
}): OwnProfileSnapshot {
  const image = updateOwnProfileSchema.shape.imageUrl.safeParse(record.image);
  return {
    name: record.name,
    imageUrl: image.success ? (image.data ?? null) : null,
    hasPhoto: Boolean(record.image),
  };
}
export async function readOwnProfileTx(
  tx: FinanceTransaction,
  actor: Actor,
): Promise<Awaited<ReturnType<typeof lockOwnProfileTx>>> {
  if (!actorCan(actor, "use:ai_chat"))
    throw new OwnProfileError("FORBIDDEN", "Akses chat tidak tersedia.");
  const u = await lockOwnProfileTx(tx, actor);
  const permission = await tx.query.rolePermission.findFirst({
    where: and(
      eq(rolePermission.roleId, u.roleId),
      eq(rolePermission.permissionKey, "use:ai_chat"),
    ),
  });
  if (!permission)
    throw new OwnProfileError("FORBIDDEN", "Akses chat berubah. Periksa akses akun Anda.");
  return u;
}
export async function ownProfilePhotoTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
): Promise<typeof attachment.$inferSelect> {
  const [row] = await tx
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, id),
        eq(attachment.tenantId, INSTANCE_TENANT_ID),
        eq(attachment.uploadedById, actor.userId),
      ),
    )
    .for("share");
  if (!row || row.referenceType !== "private_ai_chat" || !row.storageFileId)
    throw new OwnProfileError("FORBIDDEN", "Foto tidak tersedia atau bukan lampiran milik Anda.");
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(row.mimeType) ||
    row.fileSize <= 0 ||
    row.fileSize > 8 * 1024 * 1024
  )
    throw new OwnProfileError(
      "VALIDATION_ERROR",
      "Gunakan lampiran JPG, PNG atau WebP maksimal8 MB.",
    );
  await authorizedPrivateAttachment(
    actor,
    new URL(`/api/media/attachments/${row.id}`, process.env.WEB_ORIGIN ?? "http://localhost:3000")
      .href,
    "ai_chat",
    tx,
  );
  return row;
}
export async function prepareOwnProfileTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: OwnProfileInput,
): Promise<OwnProfileProposal> {
  const input = ownProfileInputSchema.parse(raw),
    u = await readOwnProfileTx(tx, actor),
    before = ownProfileSnapshot(u);
  const name = input.name ?? u.name;
  const validation = updateOwnProfileSchema.safeParse({ name });
  if (!validation.success)
    throw new OwnProfileError(
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Nama tidak valid.",
    );
  const photo =
    input.photo.action === "REPLACE"
      ? await ownProfilePhotoTx(tx, actor, input.photo.attachmentId)
      : null;
  const changedFields: ("name" | "photo")[] = [];
  if (name !== u.name) changedFields.push("name");
  if (photo || (input.photo.action === "REMOVE" && u.image)) changedFields.push("photo");
  return ownProfileProposalSchema.parse({
    kind: "OWN_PROFILE",
    input,
    expectedContext: createHash("sha256")
      .update(JSON.stringify([u, photo]))
      .digest("hex"),
    before,
    after: {
      name,
      imageUrl: input.photo.action === "KEEP" ? before.imageUrl : null,
      hasPhoto: input.photo.action === "KEEP" ? before.hasPhoto : input.photo.action === "REPLACE",
    },
    photoSource: photo
      ? { id: photo.id, fileName: photo.fileName, mimeType: photo.mimeType, size: photo.fileSize }
      : null,
    changedFields,
  });
}
export async function prepareOwnProfile(
  actor: Actor,
  input: OwnProfileInput,
): Promise<OwnProfileProposal> {
  return db.transaction((tx) => prepareOwnProfileTx(tx, actor, input));
}

export async function ownProfileContext(
  actor: Actor,
  input: { readonly photoQuery?: string; readonly offset: number },
): Promise<{
  readonly profile: ReturnType<typeof ownProfileSnapshot>;
  readonly photos: readonly {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    previewUrl: string;
  }[];
  readonly hasMore: boolean;
  readonly nextOffset: number | null;
  readonly needsPhotoChoice: boolean;
}> {
  const profile = await db.transaction((tx) => readOwnProfileTx(tx, actor));
  const photos = await db.query.attachment.findMany({
    where: and(
      eq(attachment.tenantId, INSTANCE_TENANT_ID),
      eq(attachment.uploadedById, actor.userId),
      eq(attachment.referenceType, "private_ai_chat"),
      inArray(attachment.mimeType, ["image/jpeg", "image/png", "image/webp"]),
      lte(attachment.fileSize, 8 * 1024 * 1024),
      gte(attachment.fileSize, 1),
      isNotNull(attachment.storageFileId),
      input.photoQuery
        ? ilike(attachment.fileName, `%${input.photoQuery.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
        : undefined,
    ),
    orderBy: [desc(attachment.createdAt), asc(attachment.id)],
    limit: 21,
    offset: input.offset,
  });
  return {
    profile: ownProfileSnapshot(profile),
    photos: photos.slice(0, 20).map((p) => ({
      id: p.id,
      fileName: p.fileName,
      mimeType: p.mimeType,
      size: p.fileSize,
      previewUrl: `/api/media/attachments/${p.id}`,
    })),
    hasMore: photos.length > 20,
    nextOffset: photos.length > 20 ? input.offset + 20 : null,
    needsPhotoChoice:
      !input.photoQuery ||
      input.photoQuery.length === 1 ||
      photos.length !== 1 ||
      input.offset !== 0,
  };
}
