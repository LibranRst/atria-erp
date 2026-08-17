import type { Meta, StoryObj } from "@storybook/nextjs";

import { MetricGrid, MoneyMetricPill } from "./page-primitives";

const meta = {
  title: "ui/feedback/MoneyMetricPill",
  component: MoneyMetricPill,
  args: {
    label: "Anggaran RAB",
    amount: 60000000,
  },
} satisfies Meta<typeof MoneyMetricPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grid: StoryObj = {
  render: () => (
    <div className="w-80">
      <MetricGrid>
        <MoneyMetricPill label="Anggaran RAB" amount={60000000} />
        <MoneyMetricPill label="Realisasi RAP" amount={51200000} tone="warning" />
      </MetricGrid>
    </div>
  ),
};
