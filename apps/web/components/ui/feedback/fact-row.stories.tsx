import type { Meta, StoryObj } from "@storybook/nextjs";

import { FactRow } from "./main-surface";

const meta = {
  title: "ui/feedback/FactRow",
  component: FactRow,
  args: {
    label: "Metode",
    value: "Transfer Bank",
  },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-3xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FactRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
