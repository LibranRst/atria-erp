import type { Meta, StoryObj } from "@storybook/nextjs";

import { ValuePreviewStrip } from "./form-support";

const meta = {
  title: "ui/form/ValuePreviewStrip",
  component: ValuePreviewStrip,
  args: {
    items: [
      { label: "Sebelum", amount: 60000000 },
      { label: "Sesudah", amount: 53600000, tone: "warning" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ValuePreviewStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SourceCents: Story = {
  args: {
    items: [
      { label: "Harga satuan", amount: 11828542.55, fractionDigits: 2 },
      { label: "Subtotal klien", amount: 106456882.95, fractionDigits: 2 },
    ],
  },
};
