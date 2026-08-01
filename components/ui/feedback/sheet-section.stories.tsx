import type { Meta, StoryObj } from "@storybook/nextjs";

import { FactRow, SheetSection } from "./main-surface";

const meta = {
  title: "ui/feedback/SheetSection",
  component: SheetSection,
  args: {
    title: "Detail Pembayaran",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SheetSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <FactRow label="Metode" value="Transfer Bank" />
        <FactRow label="Rekening Tujuan" value="BCA •• 4821" />
      </>
    ),
  },
};
