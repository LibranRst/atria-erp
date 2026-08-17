import type { Meta, StoryObj } from "@storybook/nextjs";

import { SummaryFact } from "./main-surface";

const meta = {
  title: "ui/feedback/SummaryFact",
  component: SummaryFact,
  args: {
    label: "Terpakai",
    amount: 42500000,
  },
  decorators: [
    (Story) => (
      <div className="w-40">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SummaryFact>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Positive: Story = {
  args: { label: "Sisa", amount: 17500000, tone: "positive" },
};

export const Danger: Story = {
  args: { label: "Melebihi Pagu", amount: 1100000, tone: "danger" },
};
