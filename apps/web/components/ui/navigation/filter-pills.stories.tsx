import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { FilterPills, type FilterPillOption } from "./filter-pills";

const options: readonly FilterPillOption[] = [
  { value: "all", label: "Semua" },
  { value: "material", label: "Material" },
  { value: "labor", label: "Tenaga Kerja" },
  { value: "overhead", label: "Overhead" },
  { value: "contingency", label: "Kontingensi" },
];

function ControlledFilterPills(): React.JSX.Element {
  const [value, setValue] = useState("all");
  return (
    <div className="w-80">
      <FilterPills label="Kategori" value={value} options={options} onChange={setValue} />
    </div>
  );
}

const meta = {
  title: "ui/navigation/FilterPills",
  component: ControlledFilterPills,
} satisfies Meta<typeof ControlledFilterPills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
