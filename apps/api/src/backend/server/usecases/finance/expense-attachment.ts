import type { Actor } from "@backend/server/actor";
import { authorizedPrivateAttachment, type PrivateAttachmentReader } from "@backend/server/usecases/media/private-attachments";

export async function assertExpenseAttachment(
  actor: Actor,
  projectId: string,
  url: string | null | undefined,
  fileId?: string,
  reader?: PrivateAttachmentReader,
): Promise<void> {
  if (!url) return;
  const row = await authorizedPrivateAttachment(actor, url, "expense", reader);
  if (
    row.referenceId !== projectId ||
    row.uploadedById !== actor.userId ||
    (fileId !== undefined && row.id !== fileId)
  ) {
    throw new Error("FORBIDDEN: Bukti pengeluaran tidak sesuai dengan pemilik atau proyek draft.");
  }
}
