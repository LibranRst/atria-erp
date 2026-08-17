import type { Meta, StoryObj } from "@storybook/nextjs";

import { MetricGrid, MetricPill } from "./page-primitives";

const meta = {
  title: "ui/feedback/MetricPill",
  component: MetricPill,
  args: {
    label: "Terpakai",
    value: "Rp 42,5jt",
    tone: "primary",
  },
  decorators: [
    (Story) => (
      <div className="w-40">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetricPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grid: StoryObj = {
  render: () => (
    <div className="w-80">
      <MetricGrid balanceLastRow>
        <MetricPill label="Terpakai" value="Rp 42,5jt" tone="primary" />
        <MetricPill label="Sisa" value="Rp 17,5jt" tone="default" />
        <MetricPill label="Progres" value="70%" tone="warning" align="right" />
      </MetricGrid>
    </div>
  ),
};
