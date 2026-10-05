import { buildFinanceProposalTools } from "./finance-proposal-tools";
import { buildFinanceTools } from "./finance-tools";
import { createInputRequestTools } from "./input-request-tools";
import { buildLookupTools } from "./lookup-tools";
import { buildMaterialProposalTools } from "./material-proposal-tools";
import { buildOperationsTools } from "./operations-tools";
import { buildProjectProposalTools } from "./project-proposal-tools";
import { buildProjectTools } from "./project-tools";
import { buildProposalTools } from "./proposal-tools";
import { buildRoleTools } from "./role-tools";
import { buildSuggestionTools } from "./suggestion-tools";
import type { AiToolContext } from "./context";

/**
 * Registry tool untuk AI chat agent.
 *
 * Semua tool di sini WAJIB read-only. Tidak satupun boleh menulis ke database —
 * `read-only.test.ts` menggagalkan suite kalau ada yang melanggar. Penulisan
 * hanya terjadi lewat Server Action ber-RBAC setelah dikonfirmasi manusia.
 */
export function buildAiTools(context: AiToolContext) {
  return {
    ...buildProjectTools(context),
    ...buildFinanceTools(context),
    ...buildOperationsTools(context),
    ...buildLookupTools(context),
    ...buildRoleTools(context),
    ...buildProposalTools(context),
    ...buildProjectProposalTools(context),
    ...buildFinanceProposalTools(context),
    ...buildMaterialProposalTools(context),
    ...buildSuggestionTools(),
    ...createInputRequestTools(),
  };
}

export type AiToolSet = ReturnType<typeof buildAiTools>;
