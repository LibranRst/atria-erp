import type { Meta, StoryObj } from "@storybook/nextjs";

import { MobileShell } from "./mobile-shell";

const meta = {
  title: "layout/MobileShell",
  component: MobileShell,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/expenses", query: {} },
    },
  },
} satisfies Meta<typeof MobileShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="rounded-3xl bg-white p-4 shadow-surface">
        <p className="text-sm text-on-surface-variant">Konten halaman contoh.</p>
      </div>
    ),
  },
};
