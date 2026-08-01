import type { Meta, StoryObj } from "@storybook/nextjs";

import { InlineStateRow, RowGroup } from "./main-surface";

const meta = {
  title: "ui/feedback/RowGroup",
  component: RowGroup,
  decorators: [
    (Story) => (
      <div className="w-80 rounded-3xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RowGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Divided: Story = {
  args: {
    children: (
      <>
        <InlineStateRow icon="inventory_2" title="Semen" description="12 sak tersisa" />
        <InlineStateRow icon="inventory_2" title="Cat Tembok" description="4 kaleng tersisa" />
      </>
    ),
  },
};

export const Connected: Story = {
  args: {
    connected: true,
    children: (
      <>
        <InlineStateRow icon="check_circle" title="Diajukan" description="1 Agu 2026" tone="positive" />
        <InlineStateRow icon="history" title="Diproses" description="Menunggu review" tone="pending" />
      </>
    ),
  },
};
