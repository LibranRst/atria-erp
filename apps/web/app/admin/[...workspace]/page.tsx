import { notFound, redirect } from "next/navigation";
import { resolveActor } from "@/server/actor";
import { canAccessAdminPath } from "@/lib/navigation/admin-navigation";
import { workspaceHref, isWorkspacePath } from "@/lib/navigation/workspace-routes";
import { PageState } from "@/components/ui";
import LedgerPage from "@/app/ledger/page";
import ProjectsPage from "@/app/projects/page";
import { ProjectTabs } from "@/features/projects/detail/components/shared/project-tabs";
import { getProjectDetailData } from "@/features/projects/detail/server/get-project-detail-data";
import ExpensesPage from "@/app/expenses/page";
import NewExpensePage from "@/app/expenses/new/page";
import ApprovalsPage from "@/app/approvals/page";
import MaterialsPage from "@/app/materials/page";
import ReconciliationPage from "@/app/reconciliation/page";
import SettingsPage from "@/app/settings/page";
import BudgetSettingsPage from "@/app/settings/budget/page";
import CategorySettingsPage from "@/app/settings/categories/page";
import LibrarySettingsPage from "@/app/settings/library/page";
import MaterialSettingsPage from "@/app/settings/materials/page";
import ProfilePage from "@/app/profile/page";
import NotificationsPage from "@/app/notifications/page";
import AiPage from "@/app/ai/page";
import { QuickStartWorkspace } from "@/features/onboarding/components/quick-start/quick-start-workspace";
import { getQuickStartWorkspaceData } from "@/features/onboarding/server/get-quick-start-workspace-data";
import { quickStartStepIdSchema } from "@atria/core/onboarding/organization-setup";
import { OnboardingFinanceReview } from "@/features/onboarding/components/workspaces/onboarding-finance-review";
import { getOnboardingReviewPageData } from "@/features/onboarding/server/get-onboarding-review-page-data";

type Query = Readonly<Record<string, string | readonly string[] | undefined>>;
function single(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
export const dynamic = "force-dynamic";

export default async function AdminWorkspacePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly workspace: readonly string[] }>;
  readonly searchParams: Promise<Query>;
}): Promise<React.JSX.Element> {
  const { workspace } = await params;
  const path = `/${workspace.join("/")}`;
  if (!isWorkspacePath(path)) notFound();
  const query = await searchParams;
  if (single(query.surface) === "mobile") {
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") preserved.append(key, value);
      else if (value) for (const item of value) preserved.append(key, item);
    }
    redirect(workspaceHref(`/admin${path}?${preserved.toString()}`, "mobile", true));
  }
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  if (!canAccessAdminPath(path, actor.permissions))
    return (
      <PageState
        kind="restricted"
        title="Akses modul dibatasi"
        description="Workspace desktop tidak menambah hak akses modul atau proyek Anda."
      />
    );
  switch (path) {
    case "/ledger":
      return <LedgerPage />;
    case "/projects":
      return <ProjectsPage />;
    case "/expenses":
      return <ExpensesPage />;
    case "/expenses/new":
      return <NewExpensePage />;
    case "/approvals":
      return <ApprovalsPage />;
    case "/materials":
      return <MaterialsPage />;
    case "/materials/opening":
      redirect("/admin/settings?tab=readiness&flow=initial-stock");
    case "/reconciliation":
      return <ReconciliationPage />;
    case "/settings": {
      const query = await searchParams;
      return (
        <SettingsPage
          searchParams={Promise.resolve({ tab: single(query.tab), flow: single(query.flow) })}
        />
      );
    }
    case "/settings/budget":
      return <BudgetSettingsPage />;
    case "/settings/categories":
      return <CategorySettingsPage />;
    case "/settings/library":
      return <LibrarySettingsPage />;
    case "/settings/materials":
      return <MaterialSettingsPage />;
    case "/profile":
      return <ProfilePage />;
    case "/notifications":
      return <NotificationsPage />;
    case "/ai":
      return <AiPage />;
    case "/onboarding": {
      const parsedStep = quickStartStepIdSchema.safeParse(single(query.step));
      const requestedStep = parsedStep.success ? parsedStep.data : undefined;
      const result = await getQuickStartWorkspaceData(requestedStep);
      if (!result.success) {
        if (result.error.code === "UNAUTHORIZED") redirect("/login");
        if (result.error.code === "FORBIDDEN") redirect("/admin/settings?tab=readiness");
        throw new Error(result.error.message);
      }
      if (result.data.overview.quickStart.state.status === "COMPLETED")
        redirect("/admin/settings?tab=readiness");
      if (requestedStep && requestedStep !== result.data.activeStep)
        redirect(`/admin/onboarding?step=${result.data.activeStep}`);
      return <QuickStartWorkspace initialData={result.data} />;
    }
    case "/onboarding/review": {
      const data = await getOnboardingReviewPageData();
      if (data.status === "unavailable") redirect("/admin");
      return (
        <OnboardingFinanceReview pendingBatches={data.pendingBatches} simulated={data.simulated} />
      );
    }
    default: {
      if (workspace[0] === "projects" && workspace.length === 2 && workspace[1])
        return <ProjectTabs {...await getProjectDetailData(workspace[1], "/admin/projects")} />;
      notFound();
    }
  }
}
