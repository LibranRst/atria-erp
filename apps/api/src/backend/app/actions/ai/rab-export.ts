import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import { readRabExport } from "@backend/server/usecases/ai/rab-export-context";
import { RabReviewError } from "@backend/server/usecases/ai/rab-context";
import {
  rabExportIdentitySchema,
  rabExportProposalSchema,
  type RabExportView,
} from "@atria/core/ai/rab-export";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function getAiRabExportPreview(raw: unknown): Promise<ActionResponse<RabExportView>> {
  const actor = await resolveActor(),
    id = rabExportIdentitySchema.safeParse(raw);
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Masuk kembali." },
    };
  if (!id.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Ekspor hanya menerima identitas dokumen dari percakapan.",
      },
    };
  try {
    const stored = await readOwnedStoredProposal(
      db,
      actor,
      id.data,
      "prepareRabExport",
      rabExportProposalSchema,
    );
    const fresh = await readRabExport(actor, stored.proposal.input, stored.proposal.issuedAt);
    const status =
      stored.expiresAt <= Date.now()
        ? "EXPIRED"
        : JSON.stringify(fresh.proposal) !== JSON.stringify(stored.proposal)
          ? "STALE"
          : "READY";
    return {
      success: true,
      data: {
        proposal: stored.proposal,
        status,
        document: status === "READY" ? fresh.document : null,
      },
    };
  } catch (error: unknown) {
    if (error instanceof RabReviewError)
      return { success: false, error: { code: error.code, message: error.message } };
    if (error instanceof StoredProposalError)
      return { success: false, error: { code: "NOT_FOUND", message: error.message } };
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Dokumen belum dapat disiapkan. Periksa lagi.",
      },
    };
  }
}
