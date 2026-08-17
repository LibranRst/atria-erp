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
