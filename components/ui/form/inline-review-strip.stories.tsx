import type { Meta, StoryObj } from "@storybook/nextjs";

import { InlineReviewStrip } from "./guided-form";

const meta = {
  title: "ui/form/InlineReviewStrip",
  component: InlineReviewStrip,
  args: {
    items: [
      { label: "Total", amount: 6400000 },
      { label: "Sisa Anggaran", amount: 17500000, tone: "success" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineReviewStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
