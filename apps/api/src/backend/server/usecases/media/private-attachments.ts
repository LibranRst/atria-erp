import ImageKit from "@imagekit/nodejs";
import { and, eq, gte, count } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "@backend/db";
import { attachment, auditLog, project } from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { checkRateLimit } from "@backend/lib/ai/rate-limit";
import {
  attachmentMime,
  assertAttachmentBytes,
  boundedAttachmentBody,
  imagekitSource,
  privateAttachmentId,
} from "@backend/lib/media/private-attachment-policy";
import {
  privateAttachmentUploadSchema,
  type PrivateAttachmentPurpose,
  type PrivateAttachmentResult,
} from "@atria/core/media/private-attachment";

const providerFileSchema = z.object({ fileId: z.string().min(1).max(255), url: z.string().url() });
type AttachmentRow = typeof attachment.$inferSelect;
export type PrivateAttachmentReader = Pick<typeof db, "query">;
const REFERENCE_TYPES: Readonly<Record<PrivateAttachmentPurpose, string>> = {
  expense: "private_expense",
  bank_statement: "private_bank_statement",
  ai_chat: "private_ai_chat",
};

export function canReadPrivateAttachment(
  actor: Actor,
  row: Pick<AttachmentRow, "uploadedById" | "referenceType">,
): boolean {
  if (row.referenceType === "private_ai_chat")
    return row.uploadedById === actor.userId && actorCan(actor, "use:ai_chat");
  if (row.referenceType === "private_bank_statement")
    return actor.dataScope === "GLOBAL" && actorCan(actor, "reconcile:ledger");
  if (row.referenceType === "private_expense")
    return (
      actorCan(actor, "view:cost") ||
      (row.uploadedById === actor.userId && actorCan(actor, "create:cost")) ||
      actorCan(actor, "view:approval_queue")
    );
  return false;
}

async function assertAttachmentProject(
  actor: Actor,
  projectId: string,
  reader: PrivateAttachmentReader = db,
): Promise<void> {
  if (actor.dataScope === "NONE") throw new Error("Akses proyek ditolak.");
  const found = await reader.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
    columns: { projectManagerId: true },
  });
  if (!found || (actor.dataScope === "ASSIGNED" && found.projectManagerId !== actor.userId)) {
    throw new Error("Akses proyek ditolak.");
  }
}

function storageConfiguration(): { endpoint: string; key: string } {
  const endpoint =
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? process.env.IMAGEKIT_URL_ENDPOINT;
  const key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!endpoint || !key) throw new Error("Storage privat belum dikonfigurasi.");
  imagekitSource(`${endpoint.replace(/\/$/, "")}/configuration-check`, endpoint);
  return { endpoint, key };
}

export async function uploadPrivateAttachment(
  actor: Actor,
  form: FormData,
): Promise<PrivateAttachmentResult> {
  const input = privateAttachmentUploadSchema.parse({
    purpose: form.get("purpose"),
    projectId: form.get("projectId") || undefined,
  });
  const allowed =
    input.purpose === "expense"
      ? actorCan(actor, "create:cost")
      : input.purpose === "bank_statement"
        ? actor.dataScope === "GLOBAL" && actorCan(actor, "reconcile:ledger")
        : actorCan(actor, "use:ai_chat");
  if (!allowed) throw new Error("Akses unggah lampiran ditolak.");
  if (input.projectId) await assertAttachmentProject(actor, input.projectId);
  if (!checkRateLimit(`attachment:${actor.userId}`).allowed)
    throw new Error("Terlalu banyak unggahan. Coba lagi sebentar.");
  const [usage] = await db
    .select({ total: count() })
    .from(attachment)
    .where(
      and(
        eq(attachment.tenantId, INSTANCE_TENANT_ID),
        eq(attachment.uploadedById, actor.userId),
        gte(attachment.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  if ((usage?.total ?? 0) >= 100) throw new Error("Batas 100 unggahan per hari telah tercapai.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Berkas wajib disertakan.");
  const mimeType = attachmentMime(file.name, file.size);
  if (input.purpose === "expense" && !mimeType.startsWith("image/"))
    throw new Error("Bukti pengeluaran harus berupa gambar.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertAttachmentBytes(bytes, mimeType);
  const { endpoint, key } = storageConfiguration();
  const body = new FormData();
  body.set(
    "file",
    new Blob([bytes], { type: mimeType }),
    `${randomUUID()}.${file.name.split(".").at(-1)}`,
  );
  body.set("fileName", `${randomUUID()}.${file.name.split(".").at(-1)}`);
  body.set("folder", `/atria-private/${input.purpose}/${actor.userId}`);
  body.set("isPrivateFile", "true");
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body,
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Berkas belum berhasil disimpan di storage privat.");
  const stored = providerFileSchema.parse(await response.json());
  imagekitSource(stored.url, endpoint);
  try {
    const row = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(attachment)
        .values({
          tenantId: INSTANCE_TENANT_ID,
          uploadedById: actor.userId,
          fileName: Array.from(file.name)
            .map((character): string =>
              (character.codePointAt(0) ?? 0) < 32 || character === "/" || character === "\\"
                ? "_"
                : character,
            )
            .join("")
            .slice(0, 255),
          fileUrl: stored.url,
          storageFileId: stored.fileId,
          fileSize: file.size,
          mimeType,
          referenceType: REFERENCE_TYPES[input.purpose],
          referenceId: input.projectId ?? actor.userId,
        })
        .returning();
      if (!saved) throw new Error("Lampiran belum berhasil dicatat.");
      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: "UPLOAD_PRIVATE_ATTACHMENT",
        targetTable: "attachment",
        targetId: saved.id,
        newState: JSON.stringify({
          purpose: input.purpose,
          projectId: input.projectId,
          size: file.size,
        }),
      });
      return saved;
    });
    const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    return {
      fileId: row.id,
      url: new URL(`/api/media/attachments/${row.id}`, origin).href,
      fileName: row.fileName,
      size: row.fileSize,
      mimeType: row.mimeType,
    };
  } catch (error) {
    await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(stored.fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
    throw error;
  }
}

export async function authorizedPrivateAttachment(
  actor: Actor,
  url: string,
  purpose?: PrivateAttachmentPurpose,
  reader: PrivateAttachmentReader = db,
): Promise<AttachmentRow> {
  const id = privateAttachmentId(url, [
    process.env.WEB_ORIGIN ?? "http://localhost:3000",
    process.env.API_PUBLIC_URL ?? "http://localhost:3001",
  ]);
  const row = await reader.query.attachment.findFirst({
    where: and(eq(attachment.id, id), eq(attachment.tenantId, INSTANCE_TENANT_ID)),
  });
  if (
    !row ||
    !row.storageFileId ||
    !canReadPrivateAttachment(actor, row) ||
    (purpose && row.referenceType !== REFERENCE_TYPES[purpose])
  ) {
    throw new Error("Lampiran tidak tersedia atau akses ditolak.");
  }
  if (row.referenceType === "private_expense")
    await assertAttachmentProject(actor, row.referenceId, reader);
  return row;
}

export async function readPrivateAttachment(
  actor: Actor,
  url: string,
  purpose?: PrivateAttachmentPurpose,
): Promise<{ row: AttachmentRow; bytes: Buffer }> {
  const row = await authorizedPrivateAttachment(actor, url, purpose);
  const { endpoint, key } = storageConfiguration();
  const signed = new ImageKit({ privateKey: key }).helper.buildSrc({
    urlEndpoint: endpoint,
    src: imagekitSource(row.fileUrl, endpoint),
    signed: true,
    expiresIn: 60,
  });
  const response = await fetch(signed, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  const bytes = await boundedAttachmentBody(response);
  assertAttachmentBytes(bytes, row.mimeType);
  return { row, bytes };
}
