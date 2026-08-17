import type { Meta, StoryObj } from "@storybook/nextjs";

import { FormRiskNotice } from "./form-support";

const meta = {
  title: "ui/form/FormRiskNotice",
  component: FormRiskNotice,
  args: {
    title: "Perhatian",
    children: "Pastikan bukti pembayaran sudah diunggah sebelum mengajukan.",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormRiskNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Danger: Story = {
  args: {
    title: "Melebihi Anggaran",
    tone: "danger",
    children: "Pengeluaran ini melebihi sisa anggaran kategori Material sebesar Rp 1.100.000.",
  },
};

export const Warning: Story = {
  args: {
    title: "Butuh Persetujuan Owner",
    tone: "warning",
    children: "Pembayaran di atas Rp 5.000.000 memerlukan persetujuan Owner.",
  },
};

export const Success: Story = {
  args: {
    title: "Dalam Anggaran",
    tone: "success",
    children: "Pengeluaran ini masih dalam batas anggaran yang tersedia.",
  },
};
