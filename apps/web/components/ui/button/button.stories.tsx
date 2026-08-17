import type { Meta, StoryObj } from "@storybook/nextjs";

import { AppIcon } from "../icon/app-icon";
import { Button, ButtonLink, IconButton, SectionAction } from "./button";

const meta = {
  title: "ui/button/Button",
  component: Button,
  args: {
    children: "Simpan Perubahan",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Batal" },
};

export const Tertiary: Story = {
  args: { variant: "tertiary", children: "Lihat detail" },
};

export const CriticalQuiet: Story = {
  args: { variant: "criticalQuiet", children: "Hapus draf" },
};

export const Critical: Story = {
  args: { variant: "critical", children: "Hapus permanen" },
};

export const Compact: Story = {
  args: { variant: "primary", size: "compact", children: "Tambah" },
};

export const WithIcons: Story = {
  args: {
    variant: "primary",
    leadingIcon: <AppIcon name="add" className="h-4 w-4" />,
    trailingIcon: <AppIcon name="chevron_right" className="h-4 w-4" />,
  },
};

export const Pending: Story = {
  args: { variant: "primary", pending: true },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true },
};

export const FullWidth: Story = {
  args: { variant: "primary", fullWidth: true },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export const AsLink: StoryObj<typeof ButtonLink> = {
  render: (args) => <ButtonLink {...args} />,
  args: {
    href: "#",
    variant: "tertiary",
    children: "Buka proyek",
  },
};

export const Icon: StoryObj<typeof IconButton> = {
  render: (args) => <IconButton {...args} />,
  args: {
    label: "Tutup",
    icon: <AppIcon name="close" className="h-5 w-5" />,
    variant: "secondary",
  },
};

export const SectionActionDefault: StoryObj<typeof SectionAction> = {
  render: (args) => <SectionAction {...args} />,
  args: {
    label: "Lihat semua",
    href: "#",
  },
};

export const SectionActionTextOnly: StoryObj<typeof SectionAction> = {
  render: (args) => <SectionAction {...args} />,
  args: {
    label: "Lihat semua",
    href: "#",
    mode: "text-only",
  },
};
