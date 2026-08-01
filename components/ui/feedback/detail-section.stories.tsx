import type { Meta, StoryObj } from "@storybook/nextjs";

import { DetailSection, InlineStateRow, RowGroup } from "./main-surface";

const meta = {
  title: "ui/feedback/DetailSection",
  component: DetailSection,
  args: {
    title: "Material Menipis",
    count: 3,
    countLabel: "Item",
    href: "#",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    children: (
      <RowGroup>
        <InlineStateRow icon="inventory_2" title="Semen" description="12 sak tersisa" />
        <InlineStateRow icon="inventory_2" title="Cat Tembok" description="4 kaleng tersisa" />
      </RowGroup>
    ),
  },
};
