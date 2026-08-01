import type { Meta, StoryObj } from "@storybook/nextjs";

import { ConnectivityBanner, PageState } from "./page-state";

const meta = {
  title: "ui/feedback/PageState",
  component: PageState,
} satisfies Meta<typeof PageState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    kind: "loading",
    title: "Memuat data",
    description: "Ringkasan proyek sedang disiapkan.",
  },
};

export const FirstUse: Story = {
  args: {
    kind: "first-use",
    title: "Belum ada proyek",
    description: "Buat proyek pertama untuk mulai mengelola anggaran dan RAP/RAB.",
    actionLabel: "Buat Proyek",
    onAction: () => undefined,
  },
};

export const FilteredEmpty: Story = {
  args: {
    kind: "filtered-empty",
    title: "Tidak ada hasil",
    description: "Coba ubah filter atau kata kunci pencarian.",
  },
};

export const ErrorState: Story = {
  args: {
    kind: "error",
    title: "Gagal memuat data",
    description: "Periksa koneksi Anda lalu coba lagi.",
    actionLabel: "Coba Lagi",
    onAction: () => undefined,
  },
};

export const Restricted: Story = {
  args: {
    kind: "restricted",
    title: "Akses Dibatasi",
    description: "Anda tidak memiliki izin untuk melihat halaman ini.",
  },
};

export const Compact: Story = {
  args: {
    kind: "loading",
    title: "Menyiapkan data",
    description: "Mohon tunggu sebentar.",
    compact: true,
  },
};

export const Connectivity: StoryObj = {
  render: () => <ConnectivityBanner />,
  parameters: {
    docs: { description: { story: "Only renders while offline; kept as a floor card." } },
  },
};
