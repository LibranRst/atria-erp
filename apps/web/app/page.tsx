import { actorHasPermission } from "@atria/core/auth/permissions";
import { getOwnerOnboardingOverview } from "@/app/actions/onboarding";
import { resolveRoleName } from "@/lib/auth/permissions";
import { shouldRedirectToOwnerOnboarding } from "@atria/core/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { hasPendingOnboardingSetupApproval } from "@/app/actions/onboarding-review";

export const dynamic = "force-dynamic";

export default async function Home(): Promise<never> {
  const session = await requireServerSession();

  const roleName = await resolveRoleName(session.user.roleId);

  if (actorHasPermission(roleName, "manage:onboarding")) {
    const onboarding = await getOwnerOnboardingOverview();
    if (onboarding.success && shouldRedirectToOwnerOnboarding(onboarding.data)) {
      redirect(`/onboarding?step=${onboarding.data.state.currentStep}`);
    }
    redirect("/ledger");
  } else if (actorHasPermission(roleName, "review:onboarding")) {
    if (await hasPendingOnboardingSetupApproval()) redirect("/onboarding/review");
  }

  // Tangga yang sama dengan `getMobileHomeRoute`.
  if (actorHasPermission(roleName, "view:ledger")) redirect("/ledger");
  if (actorHasPermission(roleName, "view:project")) redirect("/projects");
  if (actorHasPermission(roleName, "view:inventory")) redirect("/materials");
  redirect("/projects");
}
