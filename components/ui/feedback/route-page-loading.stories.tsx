import type { Meta, StoryObj } from "@storybook/nextjs";

import { RoutePageLoading } from "./route-page-state";

const meta = {
  title: "ui/feedback/RoutePageLoading",
  component: RoutePageLoading,
} satisfies Meta<typeof RoutePageLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
