import type { Meta, StoryObj } from "@storybook/nextjs";
import { getRouter } from "@storybook/nextjs/navigation.mock";
import React from "react";
import { Toaster } from "sonner";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import ProjectDetailLoading from "@/app/projects/[id]/loading";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { ProjectOverview } from "./project-overview";
import { ProjectDetailNavigation } from "../navigation/project-detail-navigation";
import { ProjectIdentityHeader, type IdentityProject } from "./project-identity-header";
import { setProjectsFixtureScenario } from "../../../../../.storybook/projects-actions.fixture";
import {
  projectsFixtureBudget,
  projectsFixtureId,
  projectsFixturePermissions,
  type ProjectsBudgetFixtureKind,
} from "../../../../../.storybook/projects-data.fixture";

const identity: IdentityProject = {
  name: "Menteng Villa — Kitchen & Living Room Fit-Out",
  status: "ACTIVE",
  financialHealth: "HEALTHY",
  coverImageUrl: null,
  location: "Menteng, Jakarta Pusat",
  roomArea: "180 m²",
  projectType: "RESIDENTIAL",
  notes: "Data sintetis untuk tinjauan proyek. Pembaruan dapur, kabinet, dan area keluarga.",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  startDate: new Date("2026-08-10T00:00:00.000Z"),
  endDate: new Date("2026-12-15T00:00:00.000Z"),
  client: {
    name: "Keluarga Surya",
    email: "client@example.test",
    phone: null,
    address: "Jakarta Pusat",
  },
  projectManager: { name: "Karin Putri", email: "pm@example.test" },
};

function ResponsiveProjectOverview({
  kind = "approved",
  source = "ready",
  readOnly = false,
  pending = false,
  nativeFallback = false,
  skeleton = false,
}: {
  readonly kind?: ProjectsBudgetFixtureKind;
  readonly source?: "ready" | "missing" | "restricted" | "unavailable";
  readonly readOnly?: boolean;
  readonly pending?: boolean;
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const fixture = projectsFixtureBudget(kind);
  const budget = source === "ready" ? fixture : null;
  const health = resolveEffectiveProjectHealth({
    storedHealth: identity.financialHealth,
    remainingBudget: budget?.remainingBudget ?? 0,
    usedPercentage: budget?.usedPercentage ?? 0,
    categoryStatuses: budget?.categories.map((category) => category.status),
    projectedMarginPercentage: budget?.projectedMarginPercentage,
    targetMarginPercentage: budget?.targetGrossPercentage,
  });
  React.useLayoutEffect(() => {
    setProjectsFixtureScenario(pending ? "pending" : "complete");
    const router = getRouter();
    const previousPush = router.push.getMockImplementation();
    router.push.mockImplementation((href: string): void => updateBrowserUrl(href, "push"));
    return (): void => {
      setProjectsFixtureScenario("complete");
      if (previousPush) router.push.mockImplementation(previousPush);
      else router.push.mockReset();
    };
  }, [pending]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={projectsFixturePermissions(readOnly ? "read-only" : "complete")}
          user={{
            id: projectsFixtureId(201),
            name: "Karin Putri",
            image: null,
            dataScope: "GLOBAL",
          }}
        >
          <div
            className="min-h-screen bg-background"
            style={
              presentation === "desktop"
                ? { marginLeft: 208, padding: 24 }
                : { padding: "16px 12px 112px" }
            }
          >
            <div
              className={
                presentation === "desktop"
                  ? "min-w-0 space-y-4"
                  : "mx-auto w-full max-w-md space-y-3"
              }
            >
              {skeleton ? (
                <ProjectDetailLoading />
              ) : (
                <>
                  <ProjectIdentityHeader
                    project={identity}
                    budgetSource={{ status: source }}
                    effectiveHealth={health.effectiveHealth}
                    healthReasons={health.healthReasons}
                    canEdit={false}
                  />
                  <ProjectDetailNavigation
                    activeTab="overview"
                    isLocked={false}
                    onTabChange={(tab) =>
                      getRouter().push(`/projects/${projectsFixtureId(1)}?tab=${tab}`)
                    }
                  />
                  <ProjectOverview
                    budget={budget}
                    storedHealth={identity.financialHealth}
                    budgetSource={{ status: source }}
                    contractValue={fixture.contractValue}
                    actions={
                      kind === "risk"
                        ? [
                            {
                              id: "budget-risk",
                              title: "Tinjau selisih budget Material dan Subcon",
                              description:
                                "Realisasi kedua kategori melampaui alokasi dan mengurangi margin proyek.",
                              tab: "profitability",
                              severity: "CRITICAL",
                            },
                          ]
                        : []
                    }
                    readiness={[
                      {
                        id: "pm",
                        label: "Penanggung jawab",
                        value: "Siap",
                        detail: "Karin Putri ditugaskan pada proyek ini.",
                        tab: "overview",
                        tone: "APPROVED",
                      },
                      {
                        id: "budget",
                        label: "Budget internal",
                        value:
                          source !== "ready"
                            ? "Belum terverifikasi"
                            : kind === "draft"
                              ? "Draft"
                              : kind === "pending"
                                ? "Menunggu keputusan"
                                : "Disetujui",
                        detail: "Alokasi dan realisasi lima kategori.",
                        tab: "overview",
                        tone:
                          source !== "ready" || kind === "draft" || kind === "pending"
                            ? "WARNING"
                            : "APPROVED",
                      },
                      {
                        id: "rab",
                        label: "RAB klien",
                        value: "Disetujui",
                        detail: "RAB tetap memakai dokumen khusus yang aman untuk klien.",
                        tab: "rab",
                        tone: "APPROVED",
                      },
                    ]}
                    onNavigate={(tab) =>
                      getRouter().push(`/projects/${projectsFixtureId(1)}?tab=${tab}`)
                    }
                  />
                </>
              )}
              <p className="px-1 text-support text-on-surface-variant">
                Data sintetis. Keputusan dan perubahan alokasi tidak menyimpan data.
              </p>
            </div>
          </div>
          <Toaster />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Projects/Responsive overview and budget",
  component: ResponsiveProjectOverview,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/projects/${projectsFixtureId(1)}`, query: {} },
    },
  },
} satisfies Meta<typeof ResponsiveProjectOverview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const MarginRisk: Story = { args: { kind: "risk" } };
export const DraftBudget: Story = { args: { kind: "draft" } };
export const PendingBudget: Story = { args: { kind: "pending" } };
export const ZeroBudget: Story = { args: { kind: "zero" } };
export const MissingBudget: Story = { args: { source: "missing" } };
export const BudgetSourceError: Story = { args: { source: "unavailable" } };
export const RestrictedBudget: Story = { args: { source: "restricted" } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const PendingAction: Story = { args: { kind: "pending", pending: true } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const Loading: Story = { args: { skeleton: true } };
