import type { Meta, StoryObj } from "@storybook/nextjs";

import { Badge, CountBadge, MetadataChip, SectionCountPill, StatusBadge } from "./badge";

const meta = {
  title: "ui/badge/StatusBadge",
  component: StatusBadge,
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: { tone: "healthy", label: "Sehat" },
};

export const Warning: Story = {
  args: { tone: "warning", label: "Perlu perhatian" },
};

export const Critical: Story = {
  args: { tone: "critical", label: "Kritis" },
};

export const Pending: Story = {
  args: { tone: "pending", label: "Menunggu" },
};

export const Completed: Story = {
  args: { tone: "completed", label: "Selesai" },
};

export const Neutral: Story = {
  args: { tone: "neutral", label: "Utama" },
};

export const Inactive: Story = {
  args: { tone: "inactive", label: "Draf" },
};

export const AllTones: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge tone="healthy" label="Sehat" />
      <StatusBadge tone="warning" label="Perlu perhatian" />
      <StatusBadge tone="critical" label="Kritis" />
      <StatusBadge tone="pending" label="Menunggu" />
      <StatusBadge tone="completed" label="Selesai" />
      <StatusBadge tone="neutral" label="Utama" />
      <StatusBadge tone="inactive" label="Draf" />
    </div>
  ),
};

export const LegacyBadge: StoryObj<typeof Badge> = {
  render: (args) => <Badge {...args} />,
  args: { status: "OVER_BUDGET" },
};

export const Count: StoryObj<typeof CountBadge> = {
  render: (args) => <CountBadge {...args} />,
  args: { count: 4, label: "notifikasi" },
};

export const CountOverflow: StoryObj<typeof CountBadge> = {
  render: (args) => <CountBadge {...args} />,
  args: { count: 132, label: "notifikasi" },
};

export const SectionCount: StoryObj<typeof SectionCountPill> = {
  render: (args) => <SectionCountPill {...args} />,
  args: { count: 12, label: "Item" },
};

export const Metadata: StoryObj<typeof MetadataChip> = {
  render: (args) => <MetadataChip {...args} />,
  args: { children: "Kategori: Material" },
};
