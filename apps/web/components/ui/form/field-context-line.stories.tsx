import type { Meta, StoryObj } from "@storybook/nextjs";

import { FieldContextLine } from "./guided-form";

const meta = {
  title: "ui/form/FieldContextLine",
  component: FieldContextLine,
  args: {
    children: "Margin: 14.2%",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FieldContextLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = {
  args: { tone: "warning", children: "PPN belum termasuk" },
};

export const Success: Story = {
  args: { tone: "success", children: "Dalam anggaran" },
};
