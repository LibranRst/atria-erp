"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/onboarding-bank-accounts";

export async function getOwnerOnboardingBankAccounts(
  ...args: WebRpcArgs<"app/actions/onboarding-bank-accounts.getOwnerOnboardingBankAccounts">
): Promise<WebRpcResult<"app/actions/onboarding-bank-accounts.getOwnerOnboardingBankAccounts">> {
  return callBackendAction(
    "app/actions/onboarding-bank-accounts.getOwnerOnboardingBankAccounts",
    args,
    { allowCookieWrites: true },
  );
}
