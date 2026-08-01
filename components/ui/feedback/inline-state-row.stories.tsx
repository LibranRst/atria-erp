import type { Meta, StoryObj } from "@storybook/nextjs";

import { InlineStateRow } from "./main-surface";

const meta = {
  title: "ui/feedback/InlineStateRow",
  component: InlineStateRow,
  args: {
    icon: "receipt_long",
    title: "Pembelian Semen",
    description: "Rp 6.400.000 · 2 hari lalu",
  },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-3xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineStateRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Positive: Story = {
  args: { tone: "positive", icon: "check_circle", title: "Pembayaran Tukang", description: "Rp 3.200.000 · Disetujui" },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    icon: "warning",
    title: "Melebihi Anggaran",
    description: "Kategori Material · Rp 1.100.000 di atas pagu",
  },
};

export const Critical: Story = {
  args: {
    tone: "critical",
    icon: "error",
    title: "Ditolak",
    description: "Bukti pembayaran tidak lengkap",
  },
};
