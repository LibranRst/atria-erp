import type { Meta, StoryObj } from "@storybook/nextjs";

import { RoutePageError } from "./route-page-state";

const meta = {
  title: "ui/feedback/RoutePageError",
  component: RoutePageError,
  args: {
    reset: () => undefined,
  },
} satisfies Meta<typeof RoutePageError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
