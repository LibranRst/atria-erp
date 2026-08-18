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

  if (roleName === "OWNER") {
    const onboarding = await getOwnerOnboardingOverview();
    if (onboarding.success && shouldRedirectToOwnerOnboarding(onboarding.data)) {
      redirect(`/onboarding?step=${onboarding.data.state.currentStep}`);
    }
    redirect("/ledger");
  } else if (roleName === "FINANCE_ADMIN") {
    if (await hasPendingOnboardingSetupApproval()) redirect("/onboarding/review");
    redirect("/ledger");
  } else if (roleName === "PURCHASING") {
    redirect("/materials");
  } else {
    redirect("/projects");
  }
}
