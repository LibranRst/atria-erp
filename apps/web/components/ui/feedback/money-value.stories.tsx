import type { Meta, StoryObj } from "@storybook/nextjs";

import { MoneyValue } from "./page-primitives";

const meta = {
  title: "ui/feedback/MoneyValue",
  component: MoneyValue,
  args: {
    amount: 42500000,
    variant: "compactWithFull",
    size: "lg",
  },
} satisfies Meta<typeof MoneyValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
  args: { variant: "compact" },
};

export const CompactDisabledTooltip: Story = {
  args: { variant: "compact", showTooltip: false },
};

export const CompactWithFull: Story = {};

export const FullDynamicHero: Story = {
  args: { variant: "fullDynamic", size: "hero" },
};

export const Danger: Story = {
  args: { amount: -1250000, tone: "danger", size: "md" },
};
