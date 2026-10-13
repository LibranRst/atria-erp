import type { UIMessage } from "ai";

/** Proposal snapshots cannot masquerade as current data after a rejected save. */
export function markUnconfirmedProposal(
  part: UIMessage["parts"][number],
): UIMessage["parts"][number] {
  if (
    !("output" in part) ||
    typeof part.output !== "object" ||
    part.output === null ||
    !("proposal" in part.output)
  )
    return part;
  const output = part.output;
  return {
    ...part,
    output: {
      ...output,
      isConfirmedByUser: false,
      instruction: `${"instruction" in output && typeof output.instruction === "string" ? output.instruction + "\n" : ""}BELUM DIKONFIRMASI: usulan ini tidak memiliki bukti penyimpanan. before/after hanya rencana, bukan data aktual. Baca sumber terbaru sebelum menjawab keadaan saat ini atau membuat usulan baru.`,
    },
  };
}
