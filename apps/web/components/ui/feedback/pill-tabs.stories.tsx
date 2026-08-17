import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { type PillTabOption, PillTabs } from "./page-primitives";

function Demo(): React.JSX.Element {
  const options: readonly PillTabOption<"all" | "material" | "labor">[] = [
    { value: "all", label: "Semua" },
    { value: "material", label: "Material", count: 8 },
    { value: "labor", label: "Tenaga Kerja" },
  ];
  const [value, setValue] = useState<"all" | "material" | "labor">("all");
  return (
    <div className="w-80">
      <PillTabs value={value} options={options} onChange={setValue} ariaLabel="Filter kategori" />
    </div>
  );
}

const meta = {
  title: "ui/feedback/PillTabs",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
