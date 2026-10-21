import type { Meta, StoryObj } from "@storybook/nextjs";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { DesktopUIProvider } from "@/components/ui/desktop/desktop-ui-provider";
import { DashboardDesktopSkeleton } from "./dashboard-desktop-skeletons";

const meta = {
  title: "features/finance-dashboard/DesktopLoading",
  component: DashboardDesktopSkeleton,
  decorators: [
    (Story) => (
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <div className="bg-background p-6">
            <Story />
          </div>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>
    ),
  ],
} satisfies Meta<typeof DashboardDesktopSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ringkasan: Story = { args: { tab: "overview" } };
export const Persetujuan: Story = { args: { tab: "approvals" } };
export const Budget: Story = { args: { tab: "budget" } };
export const JatuhTempo: Story = { args: { tab: "cash" } };
export const Rekening: Story = { args: { tab: "accounts" } };
export const Material: Story = { args: { tab: "materials" } };
export const TwentyFiveRows: Story = { args: { tab: "approvals", pageSize: 25 } };
export const TwelveMonths: Story = { args: { tab: "overview", months: 12 } };
