import "server-only";

import type { Actor } from "@/server/actor";
import {
  resolveHomeDestinationInfo,
  type HomeDestination,
} from "./home-destination";

export type MobileHomeRoute = {
  readonly route: HomeDestination["route"];
  readonly onboardingStep: HomeDestination["onboardingStep"];
};

export async function getMobileHomeRoute(actor: Actor): Promise<MobileHomeRoute> {
  const info = await resolveHomeDestinationInfo(actor);
  return {
    route: info.route,
    onboardingStep: info.onboardingStep,
  };
}
