import type { Meta, StoryObj } from "@storybook/nextjs";

import { GroupedSurface, InlineStateRow, RowGroup } from "./main-surface";

const meta = {
  title: "ui/feedback/GroupedSurface",
  component: GroupedSurface,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GroupedSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRows: Story = {
  args: {
    children: (
      <RowGroup>
        <InlineStateRow
          icon="receipt_long"
          title="Pembelian Semen"
          description="Rp 6.400.000 · 2 hari lalu"
        />
        <InlineStateRow
          icon="check_circle"
          title="Pembayaran Tukang"
          description="Rp 3.200.000 · Disetujui"
          tone="positive"
        />
      </RowGroup>
    ),
  },
};
