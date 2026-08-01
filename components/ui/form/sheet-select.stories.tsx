import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import type { SelectOption } from "./form-control-types";
import { SheetSelect } from "./select-form-controls";

const categoryOptions: readonly SelectOption[] = [
  { value: "material", label: "Material", description: "Semen, cat, keramik" },
  { value: "labor", label: "Tenaga Kerja" },
  { value: "overhead", label: "Overhead" },
  { value: "contingency", label: "Kontingensi", disabled: true, disabledReason: "Butuh approval" },
];

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("material");
  return (
    <div className="w-80">
      <SheetSelect label="Kategori Biaya" value={value} options={categoryOptions} onChange={setValue} />
    </div>
  );
}

const meta = {
  title: "ui/form/SheetSelect",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
