import type { Meta, StoryObj } from "@storybook/nextjs";
import { CashFlowTrendChart } from "./cash-flow-trend-chart";
import { GroupedSurface } from "./main-surface";
import { DesktopUIProvider } from "../desktop/desktop-ui-provider";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
const meta = {
  title: "ui/feedback/CashFlowTrendChart",
  component: CashFlowTrendChart,
  decorators: [
    (Story) => (
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <GroupedSurface variant="desktopPanel" className="max-w-3xl p-4">
            <Story />
          </GroupedSurface>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>
    ),
  ],
} satisfies Meta<typeof CashFlowTrendChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SixMonths: Story = {
  args: {
    buckets: Array.from({ length: 6 }, (_, index) => ({
      monthKey: `2026-${String(index + 5).padStart(2, "0")}`,
      cashIn: 90000000 + index * 7500000,
      cashOut: 58000000 + index * 5500000,
      net: 32000000 + index * 2000000,
      isPartial: index === 5,
    })),
  },
};
export const TwelveMonths: Story = {
  args: {
    buckets: Array.from({ length: 12 }, (_, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      cashIn: 45000000 + index * 2500000,
      cashOut: 30000000 + index * 2000000,
      net: 15000000 + index * 500000,
      isPartial: index === 11,
    })),
  },
};
