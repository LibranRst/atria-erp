import type { Meta, StoryObj } from "@storybook/nextjs";

import { Badge } from "../badge/badge";
import { SectionHeader } from "./main-surface";

const meta = {
  title: "ui/feedback/SectionHeader",
  component: SectionHeader,
  args: {
    title: "Ringkasan Proyek",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCount: Story = {
  args: { title: "Item RAB", count: 12, countLabel: "Item" },
};

export const WithMeta: Story = {
  args: { title: "Riwayat", meta: "Update 5 menit lalu" },
};

export const WithTitleAction: Story = {
  args: {
    title: "Persetujuan",
    titleAction: <Badge status="PENDING_APPROVAL">Menunggu</Badge>,
  },
};
