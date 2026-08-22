import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import type { SelectOption } from "./form-control-types";
import { FilterSelect } from "./select-form-controls";

const categoryOptions: readonly SelectOption[] = [
  { value: "material", label: "Material", description: "Semen, cat, keramik" },
  { value: "labor", label: "Tenaga Kerja" },
  { value: "overhead", label: "Overhead" },
];

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("material");
  return (
    <div className="w-80">
      <FilterSelect label="Kategori" value={value} options={categoryOptions} onChange={setValue} />
    </div>
  );
}

const activityOptions: readonly SelectOption[] = [
  { value: "all", label: "Semua" },
  { value: "one", label: "Pilihan satu" },
  { value: "two", label: "Pilihan dua" },
];

function ActivityGridDemo(): React.JSX.Element {
  const [project, setProject] = useState("all");
  const [location, setLocation] = useState("all");

  return (
    <div className="w-80 space-y-3">
      <div data-testid="select-grid" className="grid grid-cols-2 gap-2">
        <FilterSelect
          label="Project"
          value={project}
          options={activityOptions}
          onChange={setProject}
        />
        <FilterSelect
          label="Lokasi"
          value={location}
          options={activityOptions}
          onChange={setLocation}
        />
      </div>
      <div data-testid="after-select-row" className="h-16 rounded-inset bg-white" />
    </div>
  );
}

const meta = {
  title: "ui/form/FilterSelect",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};

export const ActivityGrid: Story = {
  render: () => <ActivityGridDemo />,
};
