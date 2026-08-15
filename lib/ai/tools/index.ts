import "server-only";

import { buildFinanceTools } from "./finance-tools";
import { buildOperationsTools } from "./operations-tools";
import { buildProposalTools } from "./proposal-tools";
import { buildProjectTools } from "./project-tools";
import { buildSuggestionTools } from "./suggestion-tools";
import type { AiToolContext } from "./context";

/**
 * Registry tool untuk AI chat agent.
 *
 * Semua tool di sini WAJIB read-only. Tidak satupun boleh menulis ke database —
 * `read-only.test.ts` menggagalkan suite kalau ada yang melanggar. Penulisan
 * hanya terjadi lewat Server Action ber-RBAC setelah dikonfirmasi manusia.
 *
 * Identitas sesi ditutup (closure) ke dalam setiap tool; model tidak pernah
 * mengirim id pengguna atau peran. Setiap `projectId` dari model diperiksa ulang
 * sebelum query dijalankan.
 */
export function buildAiTools(context: AiToolContext) {
  return {
    ...buildProjectTools(context),
    ...buildFinanceTools(context),
    ...buildOperationsTools(context),
    ...buildProposalTools(context),
    ...buildSuggestionTools(),
  };
}

export type AiToolSet = ReturnType<typeof buildAiTools>;
