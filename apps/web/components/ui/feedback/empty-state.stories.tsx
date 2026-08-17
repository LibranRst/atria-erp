import type { Meta, StoryObj } from "@storybook/nextjs";

import { EmptyState } from "./page-primitives";

const meta = {
  title: "ui/feedback/EmptyState",
  component: EmptyState,
  args: {
    title: "Belum Ada Data",
    description: "Data akan muncul setelah transaksi pertama tercatat.",
    icon: "inbox",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
