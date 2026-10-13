import type { Meta, StoryObj } from "@storybook/nextjs";

import { SheetFooterActions } from "./sheet-footer-actions";

const meta = {
  title: "ui/overlay/SheetFooterActions",
  component: SheetFooterActions,
} satisfies Meta<typeof SheetFooterActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryOnly: Story = {
  args: {
    primary: { label: "Simpan Perubahan" },
  },
};

export const PrimaryAndSecondary: Story = {
  args: {
    primary: { label: "Setujui" },
    secondary: { label: "Batal" },
  },
};

export const AdaptiveCardActions: Story = {
  args: {
    layout: "adaptive",
    primary: { label: "Verifikasi pengeluaran" },
    secondary: { label: "Koreksi lewat chat", variant: "quiet" },
  },
  render: (args) => (
    <div className="max-w-md rounded-owner bg-surface-container-lowest p-4">
      <SheetFooterActions {...args} />
    </div>
  ),
};

export const ReviewCanvasActions: Story = {
  args: {
    desktopStacked: true,
    layout: "adaptive",
    primaryFirst: true,
    primary: { label: "Cocokkan 4 pasangan" },
    secondary: { label: "Koreksi lewat chat", variant: "quiet" },
  },
  render: (args) => (
    <div className="max-w-md bg-surface-container-low p-4">
      <SheetFooterActions {...args} />
    </div>
  ),
};

export const Pending: Story = {
  args: {
    primary: { label: "Simpan", pending: true, pendingLabel: "Menyimpan…" },
    secondary: { label: "Batal", disabled: true },
  },
};

export const WithDisabledReason: Story = {
  args: {
    primary: { label: "Ajukan Persetujuan", disabled: true },
    secondary: { label: "Batal" },
    disabledReason: "Lengkapi bukti pembayaran sebelum mengajukan.",
  },
};
