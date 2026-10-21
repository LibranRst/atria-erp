import type { Meta, StoryObj } from "@storybook/nextjs";
import { getRouter } from "@storybook/nextjs/navigation.mock";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider, PageState } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl, updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import ProjectsLoading from "@/app/projects/loading";
import { GlobalProjectDrawer } from "../drawers/global-project-drawer";
import { ProjectListClient } from "./project-list-client";
import { ProjectDesktopSkeleton } from "./project-desktop-skeleton";
import { setProjectsFixtureScenario } from "../../../../../.storybook/projects-actions.fixture";
import {
  projectsFixtureData,
  projectsFixtureId,
  projectsFixturePermissions,
  type ProjectsFixtureScenario,
} from "../../../../../.storybook/projects-data.fixture";

function ResponsiveProjects({
  scenario = "complete",
  nativeFallback = false,
  skeleton = false,
  contextSkeleton = false,
}: {
  readonly scenario?: ProjectsFixtureScenario;
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
  readonly contextSkeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  React.useLayoutEffect(() => {
    const router = getRouter();
    const previousReplace = router.replace.getMockImplementation();
    const previousPush = router.push.getMockImplementation();
    router.replace.mockImplementation((href: string): void => updateBrowserUrl(href, "replace"));
    router.push.mockImplementation((href: string): void => updateBrowserUrl(href, "push"));
    setProjectsFixtureScenario(scenario);
    for (const key of [
      "filter",
      "search",
      "new-project",
      "project",
      "page",
      "client",
      "pm",
      "risk",
    ]) {
      updateUrlSearchParam(key, null);
    }
    return (): void => {
      setProjectsFixtureScenario("complete");
      if (previousReplace) router.replace.mockImplementation(previousReplace);
      else router.replace.mockReset();
      if (previousPush) router.push.mockImplementation(previousPush);
      else router.push.mockReset();
    };
  }, [scenario]);

  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={projectsFixturePermissions(scenario)}
          user={{
            id: projectsFixtureId(201),
            roleId: projectsFixtureId(900),
            name: "Karin Putri",
            image: null,
            dataScope: scenario === "assigned" ? "ASSIGNED" : "GLOBAL",
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
              {scenario === "source-error" ? (
                <PageState
                  kind="error"
                  title="Daftar proyek belum dapat dimuat"
                  description="Sumber proyek belum merespons. Nilai budget dan kondisi proyek belum dapat dipastikan."
                />
              ) : contextSkeleton && presentation === "desktop" ? (
                <ProjectDesktopSkeleton showDetail />
              ) : skeleton ? (
                <ProjectsLoading />
              ) : (
                <ProjectListClient {...projectsFixtureData(scenario)} />
              )}
              <p className="px-1 text-support text-on-surface-variant">
                Data sintetis untuk tinjauan visual. Pembuatan, perubahan, dan keputusan tidak
                menyimpan data.
              </p>
            </div>
          </div>
          <GlobalProjectDrawer />
          <Toaster />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Projects/Responsive portfolio",
  component: ResponsiveProjects,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/projects", query: {} } },
  },
} satisfies Meta<typeof ResponsiveProjects>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const ReadOnly: Story = { args: { scenario: "read-only" } };
export const Assigned: Story = { args: { scenario: "assigned" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const SourceError: Story = { args: { scenario: "source-error" } };
export const PendingAction: Story = { args: { scenario: "pending" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const Loading: Story = { args: { skeleton: true } };
export const ContextLoading: Story = { args: { contextSkeleton: true } };
