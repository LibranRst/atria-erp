import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { MaterialMasterProposalCard } from "./material-master-proposal-card";
import type { MaterialReviewScenario } from "@/.storybook/material-ai-actions.fixture";
function ResponsiveReview({
  scenario = "batch-500",
}: {
  readonly scenario?: MaterialReviewScenario;
}): React.JSX.Element {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = (): void => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <WorkspacePresentationProvider presentation={desktop ? "desktop" : "mobile"}>
      <DesktopUIProvider responsive>
        <div
          data-atria-admin={desktop ? "" : undefined}
          className={`mx-auto p-4 ${desktop ? "max-w-240" : "max-w-md"}`}
        >
          <MaterialMasterProposalCard
            conversationId="10000000-0000-4000-8000-000000000001"
            toolCallId={scenario}
          />
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const meta: Meta<typeof ResponsiveReview> = {
  title: "AI/Material Master Review",
  component: ResponsiveReview,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Batch500: Story = {};
export const AllSelected: Story = { args: { scenario: "all-selected" } };
export const PartialSelected: Story = { args: { scenario: "partial-selected" } };
export const PartialSaved: Story = { args: { scenario: "partial-saved" } };
export const AllSaved: Story = { args: { scenario: "all-saved" } };
export const NoneSelected: Story = { args: { scenario: "none-selected" } };
export const NeedsReview: Story = { args: { scenario: "needs-review" } };
export const Analysing: Story = { args: { scenario: "analysing" } };
export const Failed: Story = { args: { scenario: "failed" } };
export const Cancelled: Story = { args: { scenario: "cancelled" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const SaveError: Story = { args: { scenario: "save-error" } };
