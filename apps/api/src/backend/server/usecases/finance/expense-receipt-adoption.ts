import { and, eq } from "drizzle-orm";
import { attachment, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "./mutation-access";
import { authorizedPrivateAttachment } from "../media/private-attachments";
/** Preserve the chat evidence; a submitted claim gets its own project-scoped access record. */
export async function adoptExpenseReceiptTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const original = await authorizedPrivateAttachment(actor, url, undefined, tx);
  if (original.uploadedById !== actor.userId)
    throw new Error("FORBIDDEN: Bukti bukan milik pengaju.");
  if (original.referenceType === "private_expense") {
    if (original.referenceId !== projectId)
      throw new Error("FORBIDDEN: Bukti tidak sesuai proyek.");
    return url;
  }
  if (original.referenceType !== "private_ai_chat" || !original.mimeType.startsWith("image/"))
    throw new Error("FORBIDDEN: Bukti pengeluaran harus gambar nota milik pengaju.");
  await tx.select().from(attachment).where(eq(attachment.id, original.id)).for("update");
  let proof = await tx.query.attachment.findFirst({
    where: and(
      eq(attachment.tenantId, INSTANCE_TENANT_ID),
      eq(attachment.storageFileId, original.storageFileId!),
      eq(attachment.uploadedById, actor.userId),
      eq(attachment.referenceType, "private_expense"),
      eq(attachment.referenceId, projectId),
    ),
  });
  if (!proof)
    proof = (
      await tx
        .insert(attachment)
        .values({
          fileName: original.fileName,
          fileUrl: original.fileUrl,
          storageFileId: original.storageFileId,
          fileSize: original.fileSize,
          mimeType: original.mimeType,
          uploadedById: actor.userId,
          referenceType: "private_expense",
          referenceId: projectId,
        })
        .returning()
    )[0];
  return new URL(
    `/api/media/attachments/${proof.id}`,
    process.env.WEB_ORIGIN ?? "http://localhost:3000",
  ).href;
}
