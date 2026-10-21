import type { Meta, StoryObj } from "@storybook/nextjs";
import { getRouter } from "@storybook/nextjs/navigation.mock";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider, PageState } from "@/components/ui";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { ProjectDetailNavigation } from "../navigation/project-detail-navigation";
import { ProjectIdentityHeader, type IdentityProject } from "../overview/project-identity-header";
import { RapRabManager } from "./rap-rab-manager";
import { ProjectPlanningDesktopLoading } from "./project-planning-desktop-loading";
import { setRapRabFixtureScenario } from "../../../../../.storybook/rap-rab-actions.fixture";
import {
  rapRabFixtureData,
  rapRabFixtureId,
  rapRabFixturePermissions,
  type RapRabFixtureAccess,
  type RapRabFixtureKind,
} from "../../../../../.storybook/rap-rab-data.fixture";

const identity: IdentityProject = {
  name: "Menteng Villa — Kitchen & Living Room Fit-Out",
  status: "ACTIVE",
  financialHealth: "HEALTHY",
  coverImageUrl: null,
  location: "Menteng, Jakarta Pusat",
  roomArea: "180 m²",
  projectType: "RESIDENTIAL",
  notes: "Contoh sintetis untuk tinjauan RAP dan RAB. Pembaruan dapur, kabinet dan area keluarga.",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  startDate: new Date("2026-08-10T00:00:00Z"),
  endDate: new Date("2026-12-15T00:00:00Z"),
  client: {
    name: "Keluarga Surya",
    email: "client@example.test",
    phone: null,
    address: "Jakarta Pusat",
  },
  projectManager: { name: "Karin Putri", email: "pm@example.test" },
};

function ResponsiveProjectPlanning({
  kind = "complete",
  mode = "rap",
  access = "owner",
  pending = false,
  nativeFallback = false,
  skeleton = false,
}: {
  readonly kind?: RapRabFixtureKind;
  readonly mode?: "rap" | "rab";
  readonly access?: RapRabFixtureAccess;
  readonly pending?: boolean;
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const [activeMode, setActiveMode] = React.useState(mode);
  const data = React.useMemo(() => rapRabFixtureData(kind), [kind]);
  React.useLayoutEffect(() => {
    setRapRabFixtureScenario(pending ? "pending" : "complete");
    const router = getRouter();
    const previousPush = router.push.getMockImplementation();
    router.push.mockImplementation((href: string): void => updateBrowserUrl(href, "push"));
    return (): void => {
      setRapRabFixtureScenario("complete");
      if (previousPush) router.push.mockImplementation(previousPush);
      else router.push.mockReset();
    };
  }, [pending]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={rapRabFixturePermissions(access)}
          user={{ id: rapRabFixtureId(701), name: "Karin Putri", image: null, dataScope: "GLOBAL" }}
        >
          <ActivityDetailProvider>
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
                  <ProjectPlanningDesktopLoading kind={activeMode} />
                ) : (
                  <>
                    <ProjectIdentityHeader
                      project={identity}
                      budgetSource={{ status: "ready" }}
                      effectiveHealth="HEALTHY"
                      healthReasons={[]}
                      canEdit={false}
                    />
                    <ProjectDetailNavigation
                      activeTab={activeMode}
                      isLocked={data.rabEstimate?.status !== "APPROVED"}
                      onTabChange={(tab): void => {
                        if (tab === "rap" || tab === "rab") setActiveMode(tab);
                        getRouter().push(`/projects/${data.projectId}?tab=${tab}`);
                      }}
                    />
                    {access === "restricted" ? (
                      <PageState
                        kind="restricted"
                        title={`Akses ${activeMode.toUpperCase()} terbatas`}
                        description="Akun ini tidak memiliki izin untuk melihat rencana atau penawaran proyek."
                      />
                    ) : (
                      <RapRabManager {...data} mode={activeMode} userRole="CUSTOM" />
                    )}
                  </>
                )}
                <p className="px-1 text-support text-on-surface-variant">
                  Data sintetis. Tindakan tidak menyimpan data atau menghubungi backend. Dokumen
                  ekspor hanya memuat contoh sintetis.
                </p>
              </div>
            </div>
            <Toaster />
          </ActivityDetailProvider>
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Projects/Responsive RAP and RAB",
  component: ResponsiveProjectPlanning,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResponsiveProjectPlanning>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RapComplete: Story = {};
export const RapDraftMaterial: Story = { args: { kind: "draft-material" } };
export const RabDraft: Story = { args: { kind: "rab-draft", mode: "rab" } };
export const RabApproved: Story = { args: { mode: "rab" } };
export const RapDraftTukang: Story = { args: { kind: "draft-tukang" } };
export const RapDraftSubcon: Story = { args: { kind: "draft-subcon" } };
export const RapDraftReview: Story = { args: { kind: "draft-review" } };
export const RapSkippedScopes: Story = { args: { kind: "skipped-scope" } };
export const RapEmpty: Story = { args: { kind: "empty" } };
export const RabEmpty: Story = { args: { kind: "rab-empty", mode: "rab" } };
export const RabRevision: Story = { args: { kind: "rab-revision", mode: "rab" } };
export const RabStaleSources: Story = { args: { kind: "stale-source", mode: "rab" } };
export const RapReadOnly: Story = { args: { access: "read-only" } };
export const RabReadOnly: Story = { args: { kind: "rab-draft", mode: "rab", access: "read-only" } };
export const EditorWithoutApproval: Story = {
  args: { kind: "rab-draft", mode: "rab", access: "editor" },
};
export const ApproverWithoutEditing: Story = {
  args: { kind: "rab-draft", mode: "rab", access: "approver" },
};
export const RapEditorWithoutFinalization: Story = {
  args: { kind: "draft-review", access: "rap-editor" },
};
export const Restricted: Story = { args: { access: "restricted" } };
export const RapPending: Story = { args: { kind: "draft-review", pending: true } };
export const RabPending: Story = { args: { kind: "rab-draft", mode: "rab", pending: true } };
export const RapNativeFallback: Story = { args: { nativeFallback: true } };
export const RabNativeFallback: Story = {
  args: { kind: "rab-draft", mode: "rab", nativeFallback: true },
};
export const RapLoading: Story = { args: { skeleton: true } };
export const RabLoading: Story = { args: { skeleton: true, mode: "rab" } };
