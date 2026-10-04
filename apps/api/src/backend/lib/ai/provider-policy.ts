import { z } from "zod";

export const chatProviderSchema = z.enum(["NINEROUTER", "DEEPSEEK", "GEMINI", "OPENROUTER"]);
export type ApprovedProvider = z.infer<typeof chatProviderSchema>;

export function configuredChatProviders(value: string | undefined): ApprovedProvider[] {
  return value === undefined
    ? ["NINEROUTER", "DEEPSEEK", "GEMINI", "OPENROUTER"]
    : z.array(chatProviderSchema).parse(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
}

export function assertApprovedAiProvider(
  provider: ApprovedProvider,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const confidential =
    environment.ATRIA_PILOT_REAL_DATA === "true" ||
    (environment.NODE_ENV === "production" && environment.ATRIA_PILOT_REAL_DATA !== "false");
  if (!confidential) return;
  const approved = configuredChatProviders(environment.AI_APPROVED_PROVIDERS ?? "");
  if (
    !approved.includes(provider) ||
    (provider === "GEMINI" && environment.GEMINI_PAID_DATA_POLICY_CONFIRMED !== "true")
  ) {
    throw new Error("Penyedia AI belum disetujui untuk data perusahaan. Hubungi administrator.");
  }
}

export function approvedChatProviders(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ApprovedProvider[] {
  return configuredChatProviders(environment.AI_CHAT_PROVIDERS).filter((provider) => {
    try {
      assertApprovedAiProvider(provider, environment);
      return true;
    } catch {
      return false;
    }
  });
}
