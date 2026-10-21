import "server-only";

import type { ServerSession } from "@atria/api/contract";
import { BackendTransportError } from "@atria/api-client";
import { isDeveloperAccountSimulationEnabled } from "@atria/core/auth/developer-account-simulation";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { callBackendData } from "../api/backend";
import { readBackendSession } from "../api/session";
import { adminLocalHref, safeAdminReturnTo } from "../navigation/paths";
import { adminAccessDecision, type AdminActor } from "./policy";

export type { AdminActor } from "./policy";

/** React cache shares only the active server render; transport remains no-store. */
export const readSession = cache(async (): Promise<ServerSession> => {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  return readBackendSession(requestHeaders);
});

export const resolveActor = cache(async (): Promise<AdminActor | null> => {
  try {
    return await callBackendData("server/actor.resolveActor", []);
  } catch (error: unknown) {
    if (error instanceof BackendTransportError && error.code === "UNAUTHORIZED") return null;
    throw error;
  }
});

export interface RequireAdminActorOptions {
  readonly allowPasswordChange?: boolean;
  readonly allowOnboarding?: boolean;
  readonly returnTo?: string;
}

export async function requireAdminActor(
  options: RequireAdminActorOptions = {},
): Promise<AdminActor> {
  const actor = await resolveActor();
  const requestPath = (await headers()).get("x-atria-admin-pathname");
  const destination = safeAdminReturnTo(options.returnTo ?? requestPath ?? undefined);
  const decision = adminAccessDecision({
    actor,
    allowPasswordChange: options.allowPasswordChange || requestPath === "/change-password",
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
  });
  if (decision === "login") redirect(`/login?returnTo=${encodeURIComponent(destination)}`);
  if (decision === "password") redirect("/change-password");
  if (decision === "restricted") redirect("/restricted");
  if (!actor) redirect("/login");
  if (
    !options.allowPasswordChange &&
    requestPath !== "/change-password" &&
    !options.allowOnboarding &&
    requestPath !== "/onboarding"
  ) {
    const home = await callBackendData(
      "features/navigation/server/home-destination.resolveHomeDestination",
      [actor],
    );
    const homeHref = adminLocalHref(home);
    if (homeHref?.startsWith("/onboarding")) redirect(homeHref);
  }
  return actor;
}
