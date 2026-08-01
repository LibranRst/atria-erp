import type { Meta, StoryObj } from "@storybook/nextjs";

import { SmartDefaultHint } from "./guided-form";

const meta = {
  title: "ui/form/SmartDefaultHint",
  component: SmartDefaultHint,
  args: {
    children: "metode pembayaran terakhir (Transfer Bank)",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SmartDefaultHint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
