import type { Meta, StoryObj } from "@storybook/nextjs";

import { MetricGrid, MetricPill } from "./page-primitives";

const meta = {
  title: "ui/feedback/MetricGrid",
  component: MetricGrid,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetricGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BalancedLastRow: Story = {
  args: {
    balanceLastRow: true,
    children: (
      <>
        <MetricPill label="Terpakai" value="Rp 42,5jt" tone="primary" />
        <MetricPill label="Sisa" value="Rp 17,5jt" tone="default" />
        <MetricPill label="Progres" value="70%" tone="warning" align="right" />
      </>
    ),
  },
};
