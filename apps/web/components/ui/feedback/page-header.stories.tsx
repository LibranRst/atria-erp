import type { Meta, StoryObj } from "@storybook/nextjs";

import { Badge } from "../badge/badge";
import { PageHeader } from "./page-primitives";

const meta = {
  title: "ui/feedback/PageHeader",
  component: PageHeader,
  args: {
    eyebrow: "Proyek",
    title: "Renovasi Rumah",
    subtitle: "Jl. Kenanga No. 12, Jakarta Selatan",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBadge: Story = {
  args: { badge: <Badge status="ACTIVE" /> },
};
