export const FINAL_FOLLOW_UP_TOOL_NAME = "suggestFollowUps";

type CompletedStep = {
  readonly text: string;
  readonly toolCalls: readonly { readonly toolName: string }[];
};

/**
 * Follow-up adalah terminal hanya setelah jawaban user-facing sudah tersedia.
 * Beberapa provider kadang memanggil tool ini terlalu awal; menghentikan loop
 * saat itu akan meninggalkan chips tanpa jawaban.
 */
export function shouldStopAfterFinalFollowUps(steps: readonly CompletedStep[]): boolean {
  const lastStep = steps[steps.length - 1];
  const calledFollowUps =
    lastStep?.toolCalls.some((toolCall) => toolCall.toolName === FINAL_FOLLOW_UP_TOOL_NAME) ??
    false;
  const hasAnswer = steps.some((step) => step.text.trim().length > 0);

  return calledFollowUps && hasAnswer;
}

export function shouldStopAfterReadyProposal(
  question: string,
  steps: readonly {
    readonly toolResults: readonly { readonly toolName: string; readonly output: unknown }[];
    readonly content?: readonly { readonly type: string }[];
  }[],
  proposalTools: ReadonlySet<string>,
): boolean {
  // Only a single explicit command can finish with its actual review card.
  // Mixed requests, questions and references still receive normal orchestration.
  const intent = question.replace(/\bjangan\b[^.!?\n]*/gi, "").trim();
  if (
    !/^(?:tolong\s+)?(?:siapkan|buat|ubah|ganti|koreksi|catat|ajukan|setujui|tolak|revisi|impor|ekspor)\b/i.test(
      intent,
    ) ||
    /\b(?:dan|lalu|kemudian|juga|tapi|tetapi|namun|berapa|bagaimana|apakah|kenapa|jelaskan|tadi|itu|sebelumnya)\b|\?/i.test(
      intent,
    )
  )
    return false;
  const lastStep = steps.at(-1);
  if (
    lastStep?.content?.some((part) => part.type === "tool-error") ||
    lastStep?.toolResults.some(
      ({ output }) => typeof output === "object" && output !== null && "error" in output,
    )
  )
    return false;
  return (
    lastStep?.toolResults.some(({ toolName, output }): boolean => {
      if (
        !proposalTools.has(toolName) ||
        typeof output !== "object" ||
        output === null ||
        Array.isArray(output)
      )
        return false;
      if ("error" in output || !("proposal" in output)) return false;
      const proposal = output.proposal;
      return (
        typeof proposal === "object" &&
        proposal !== null &&
        !Array.isArray(proposal) &&
        (("kind" in proposal && typeof proposal.kind === "string") ||
          ("type" in proposal && typeof proposal.type === "string"))
      );
    }) ?? false
  );
}
