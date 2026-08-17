import type { Meta, StoryObj } from "@storybook/nextjs";

import { BottomNavBackdrop } from "./bottom-nav-parts";

const meta = {
  title: "layout/BottomNavBackdrop",
  component: BottomNavBackdrop,
  args: {
    isOpen: true,
    onClose: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="relative h-40 w-80 overflow-hidden rounded-2xl bg-surface-container-low">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomNavBackdrop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
