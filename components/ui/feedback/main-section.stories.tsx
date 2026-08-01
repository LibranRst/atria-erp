import type { Meta, StoryObj } from "@storybook/nextjs";

import { GroupedSurface, InlineStateRow, MainSection, RowGroup } from "./main-surface";

const meta = {
  title: "ui/feedback/MainSection",
  component: MainSection,
  args: {
    title: "Riwayat Pengeluaran",
    count: 4,
    countLabel: "Item",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MainSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <GroupedSurface>
        <RowGroup>
          <InlineStateRow icon="receipt_long" title="Pembelian Semen" description="Rp 6.400.000" />
          <InlineStateRow
            icon="check_circle"
            title="Pembayaran Tukang"
            description="Rp 3.200.000"
            tone="positive"
          />
        </RowGroup>
      </GroupedSurface>
    ),
  },
};
