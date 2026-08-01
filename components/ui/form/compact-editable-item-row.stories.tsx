import type { Meta, StoryObj } from "@storybook/nextjs";

import { CompactEditableItemRow } from "./guided-form";

const meta = {
  title: "ui/form/CompactEditableItemRow",
  component: CompactEditableItemRow,
  args: {
    title: "Semen 40 sak",
    meta: "Material",
    onClick: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompactEditableItemRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {
  args: { status: "complete", value: "Rp 6.400.000" },
};

export const Warning: Story = {
  args: { status: "warning", title: "Cat Tembok" },
};

export const Danger: Story = {
  args: { status: "danger", title: "Sewa Alat", meta: "Overhead", value: "Rp 1.200.000" },
};
