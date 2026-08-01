import type { Meta, StoryObj } from "@storybook/nextjs";

import { AppIcon, type AppIconName } from "./app-icon";

const meta = {
  title: "ui/icon/AppIcon",
  component: AppIcon,
  args: {
    name: "dashboard",
  },
} satisfies Meta<typeof AppIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { className: "h-6 w-6 text-on-surface" },
};

export const FilledWeight: Story = {
  args: { name: "check_circle", weight: "fill", className: "h-6 w-6 text-success" },
};

const galleryNames: readonly AppIconName[] = [
  "dashboard",
  "account_balance",
  "account_balance_wallet",
  "payments",
  "receipt_long",
  "request_quote",
  "inventory",
  "inventory_2",
  "warehouse",
  "local_shipping",
  "construction",
  "engineering",
  "architecture",
  "domain",
  "approval",
  "verified",
  "verified_user",
  "check_circle",
  "cancel",
  "warning",
  "error",
  "report",
  "lock",
  "history",
  "schedule",
  "event",
  "person",
  "logout",
  "notification_important",
  "search_off",
  "sync",
  "refresh",
  "upload_file",
  "content_copy",
  "edit",
  "delete",
  "add",
  "chevron_left",
  "chevron_right",
  "arrow_upward",
  "arrow_downward",
  "trending_up",
  "swap_horiz",
  "tune",
  "more_horiz",
];

export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-8 gap-4 bg-surface-container-lowest p-4">
      {galleryNames.map((name) => (
        <div
          key={name}
          className="flex flex-col items-center gap-1 rounded-xl p-2 text-center"
          title={name}
        >
          <AppIcon name={name} className="h-5 w-5 text-on-surface-variant" />
          <span className="w-full truncate text-[8px] text-on-surface-variant/60">{name}</span>
        </div>
      ))}
    </div>
  ),
};
