import type { Meta, StoryObj } from "@storybook/nextjs";

import { FactRow, PanelSection } from "./main-surface";

const meta = {
  title: "ui/feedback/PanelSection",
  component: PanelSection,
  args: {
    eyebrow: "RAP",
    title: "Rencana Anggaran Pelaksanaan",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <FactRow label="Total RAP" value="Rp 58.000.000" inset={false} />
        <FactRow label="Margin" value="14.2%" inset={false} />
      </>
    ),
  },
};
