"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/developer-account-simulation";

export async function getDeveloperAccountSimulationState(
  ...args: WebRpcArgs<"app/actions/developer-account-simulation.getDeveloperAccountSimulationState">
): Promise<
  WebRpcResult<"app/actions/developer-account-simulation.getDeveloperAccountSimulationState">
> {
  return callBackendAction(
    "app/actions/developer-account-simulation.getDeveloperAccountSimulationState",
    args,
    { allowCookieWrites: true },
  );
}

export async function startDeveloperAccountSimulation(
  ...args: WebRpcArgs<"app/actions/developer-account-simulation.startDeveloperAccountSimulation">
): Promise<
  WebRpcResult<"app/actions/developer-account-simulation.startDeveloperAccountSimulation">
> {
  return callBackendAction(
    "app/actions/developer-account-simulation.startDeveloperAccountSimulation",
    args,
    { allowCookieWrites: true },
  );
}

export async function stopDeveloperAccountSimulation(
  ...args: WebRpcArgs<"app/actions/developer-account-simulation.stopDeveloperAccountSimulation">
): Promise<
  WebRpcResult<"app/actions/developer-account-simulation.stopDeveloperAccountSimulation">
> {
  return callBackendAction(
    "app/actions/developer-account-simulation.stopDeveloperAccountSimulation",
    args,
    { allowCookieWrites: true },
  );
}
