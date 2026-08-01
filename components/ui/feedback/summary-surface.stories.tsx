import type { Meta, StoryObj } from "@storybook/nextjs";

import { SummaryFact, SummarySurface } from "./main-surface";

const meta = {
  title: "ui/feedback/SummarySurface",
  component: SummarySurface,
  args: {
    ariaLabel: "Ringkasan anggaran",
    eyebrow: "Anggaran",
    icon: "account_balance",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SummarySurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="grid grid-cols-2 gap-2 p-2">
        <SummaryFact label="Terpakai" amount={42500000} />
        <SummaryFact label="Sisa" amount={17500000} tone="positive" />
      </div>
    ),
  },
};

export const WithStatus: Story = {
  args: {
    eyebrow: "Status",
    icon: "domain",
    status: "Melebihi Budget",
    statusTone: "critical",
    children: (
      <div className="p-3 text-sm text-on-surface-variant">
        Proyek ini telah melebihi anggaran pada kategori Material.
      </div>
    ),
  },
};
