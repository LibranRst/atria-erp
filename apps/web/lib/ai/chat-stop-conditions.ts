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
