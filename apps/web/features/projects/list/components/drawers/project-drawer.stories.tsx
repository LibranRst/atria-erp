import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";

import {
  AppIcon,
  Button,
  DesktopUIProvider,
  GroupedSurface,
  IconButton,
  useSheetPresenceValue,
} from "@/components/ui";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { ProjectDrawer } from "./project-drawer";
import { ProjectRecoveryModal } from "./project-recovery-modal";
import { ProjectReviewSheet } from "./project-review-sheet";
import type { ProjectDrawerData } from "./project-drawer-types";
import { createProjectFormDraft } from "../../utils/project-form-draft";

// Storybook replaces create/update/upload actions with fixtures that cannot reach the API.
const project: ProjectDrawerData = {
  id: "synthetic-ui-project",
  name: "Proyek Fixture UI",
  clientId: "synthetic-client",
  projectManagerId: "synthetic-pm",
  status: "DRAFT",
  financialHealth: "HEALTHY",
  totalContractValue: 1_000_000,
};
const clients = [{ id: project.clientId, name: "Klien Fixture" }];
const users = [{ id: "synthetic-pm", name: "PM Fixture" }];

function InteractionFixture({
  desktop = false,
}: {
  readonly desktop?: boolean;
}): React.JSX.Element {
  const [selected, setSelected] = React.useState<ProjectDrawerData | null>(null);
  const [draftOpen, setDraftOpen] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  const presence = useSheetPresenceValue(selected, selected?.id);

  React.useLayoutEffect(() => {
    if (!desktop) return;
    const previous = document.body.getAttribute("data-atria-admin");
    document.body.setAttribute("data-atria-admin", "");
    return (): void => {
      if (previous === null) document.body.removeAttribute("data-atria-admin");
      else document.body.setAttribute("data-atria-admin", previous);
    };
  }, [desktop]);

  return (
    <WorkspacePresentationProvider presentation={desktop ? "desktop" : "mobile"}>
      <div
        data-atria-admin={desktop ? "" : undefined}
        className="min-h-screen bg-background text-on-surface"
      >
        <AppTopBar
          left={
            <IconButton label="Kontrol fixture" size="compact" icon={<AppIcon name="settings" />} />
          }
          center={
            <Button size="compact" variant="secondary" type="button">
              Fixture UI
            </Button>
          }
          right={<IconButton label="Info fixture" size="compact" icon={<AppIcon name="info" />} />}
        />
        <main className="mx-auto w-full max-w-md space-y-5 px-5 pt-24 pb-32">
          <h1 className="text-section font-bold">Interaksi web</h1>
          <p className="text-support text-on-surface-variant">
            Data sintetis untuk menguji motion. Tidak ada proyek yang disimpan.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setSelected(project)}>
              Edit proyek fixture
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDraftOpen(true)}>
              Konfirmasi draft fixture
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              data-testid="press-primary"
              onClick={() => setClicks((value) => value + 1)}
            >
              Uji tekan
            </Button>
            <Button type="button" variant="secondary" data-testid="press-secondary">
              Sekunder
            </Button>
            <Button type="button" variant="tertiary" data-testid="press-tertiary">
              Tersier
            </Button>
            <Button type="button" variant="criticalQuiet" data-testid="press-critical-quiet">
              Critical quiet
            </Button>
            <Button type="button" variant="critical" data-testid="press-critical">
              Critical
            </Button>
            <Button type="button" disabled data-testid="press-disabled">
              Nonaktif
            </Button>
          </div>
          <output data-testid="click-count" className="text-support">
            Klik fixture: {clicks}
          </output>
          <GroupedSurface>
            <div className="divide-y divide-outline-variant/15">
              {Array.from({ length: 36 }, (_, index) => (
                <div key={index} className="px-4 py-4">
                  <p className="text-row font-semibold">Baris uji {index + 1}</p>
                  <p className="text-support text-on-surface-variant">
                    Konten untuk memeriksa fade saat bergulir.
                  </p>
                </div>
              ))}
            </div>
          </GroupedSurface>
        </main>
        <div
          aria-hidden="true"
          className="scroll-edge-scrim scroll-edge-scrim-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto h-28 w-full max-w-md"
        />
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit gap-2">
          <IconButton label="Bar bawah fixture" icon={<AppIcon name="home" />} />
          <Button type="button" variant="secondary" onClick={() => window.history.back()}>
            Kembali
          </Button>
        </div>
        {presence.presentedValue ? (
          <ProjectDrawer
            isOpen={presence.open}
            clients={clients}
            users={users}
            editProject={presence.presentedValue}
            onClose={() => setSelected(null)}
            onExitComplete={presence.handleExitComplete}
          />
        ) : null}
        <ProjectRecoveryModal
          open={draftOpen}
          onClose={() => setDraftOpen(false)}
          onSaveAndClose={() => setDraftOpen(false)}
          onDiscard={() => setDraftOpen(false)}
        />
      </div>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "features/projects/Project drawer interaction audit",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = { render: () => <InteractionFixture /> };
export const Desktop: Story = { render: () => <InteractionFixture desktop /> };

function ReviewFixture(): React.JSX.Element {
  const [desktop, setDesktop] = React.useState(false);
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = (): void => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return (): void => media.removeEventListener("change", update);
  }, []);
  return (
    <WorkspacePresentationProvider presentation={desktop ? "desktop" : "mobile"}>
      <DesktopUIProvider responsive>
        <div className="min-h-screen bg-background p-6">
          <Button onClick={() => setOpen(true)}>Tinjau proyek fixture</Button>
          <ProjectReviewSheet
            open={open}
            editMode
            pending={false}
            draft={createProjectFormDraft(project, users)}
            clientName="Klien Fixture"
            projectManagerName="PM Fixture"
            statusLabel="Draft"
            healthLabel="Sehat"
            onClose={() => setOpen(false)}
            onSubmit={() => setOpen(false)}
          />
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

export const ResponsiveProjectReview: Story = {
  render: () => <ReviewFixture />,
};
