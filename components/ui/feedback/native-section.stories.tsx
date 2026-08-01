import type { Meta, StoryObj } from "@storybook/nextjs";

import { NativeSection } from "./page-primitives";

const meta = {
  title: "ui/feedback/NativeSection",
  component: NativeSection,
  args: {
    eyebrow: "Ringkasan",
    title: "Anggaran Bulan Ini",
    children: (
      <p className="text-sm text-on-surface-variant">
        Total pengeluaran Rp 42.500.000 dari anggaran Rp 60.000.000.
      </p>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NativeSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
