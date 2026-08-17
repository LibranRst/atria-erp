import type { Meta, StoryObj } from "@storybook/nextjs";

import { BottomNav } from "./bottom-nav";

const meta = {
  title: "layout/BottomNav",
  component: BottomNav,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/expenses", query: {} },
    },
  },
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div className="relative h-40 w-full max-w-md">
        <Story />
      </div>
    ),
  ],
};
