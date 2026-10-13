import type { Meta, StoryObj } from "@storybook/nextjs";

import { AppIcon, type AppIconName } from "./app-icon";
import { IconFamilyPreview } from "./icon-family-preview.storybook";
import { appIconByName, isAppIconName } from "@atria/icons";
import { GroupedSurface } from "../feedback/main-surface";

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
  name: "Kompatibilitas weight lama",
  args: { name: "check_circle", weight: "fill", className: "h-6 w-6 text-success" },
};

export const AllRegistered: Story = {
  name: "Semua ikon Hugeicons",
  parameters: { layout: "fullscreen" },
  render: () => (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Semua ikon Hugeicons</h1>
      <p className="text-sm text-on-surface-variant">
        Stroke Rounded gratis · {Object.keys(appIconByName).length} nama bersama · stroke 1.5. Kode
        di bawah adalah referensi pengembang.
      </p>
      <GroupedSurface className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-8">
        {Object.keys(appIconByName)
          .filter(isAppIconName)
          .map((name) => (
            <div key={name} className="flex min-w-0 flex-col items-center gap-2 p-2 text-center">
              <AppIcon name={name} className="icon-xl" />
              <code className="text-xs break-all text-on-surface-variant">{name}</code>
            </div>
          ))}
      </GroupedSurface>
    </main>
  ),
};

export const FamilyComparison: Story = {
  name: "Phosphor vs Hugeicons",
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        mobile320: { name: "Mobile 320", styles: { width: "320px", height: "844px" } },
        mobile360: { name: "Mobile 360", styles: { width: "360px", height: "844px" } },
        mobile390: { name: "Mobile 390", styles: { width: "390px", height: "844px" } },
        mobile430: { name: "Mobile 430", styles: { width: "430px", height: "932px" } },
        desktop1024: { name: "Desktop 1024", styles: { width: "1024px", height: "900px" } },
        desktop1280: { name: "Desktop 1280", styles: { width: "1280px", height: "900px" } },
        desktop1440: { name: "Desktop 1440", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
  render: () => <IconFamilyPreview />,
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
  "attach_file",
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
          <span className="w-full truncate text-xs text-on-surface-variant/60">{name}</span>
        </div>
      ))}
    </div>
  ),
};
