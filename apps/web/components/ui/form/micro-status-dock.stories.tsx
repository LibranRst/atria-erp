import type { Meta, StoryObj } from "@storybook/nextjs";

import { MicroStatusDock } from "./guided-form";

const meta = {
  title: "ui/form/MicroStatusDock",
  component: MicroStatusDock,
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
} satisfies Meta<typeof MicroStatusDock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
