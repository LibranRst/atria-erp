import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { DatePickerField } from "./date-form-controls";

const meta = {
  title: "ui/form/DatePickerField",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function DatePickerDemo(): React.JSX.Element {
  const [value, setValue] = useState("2026-08-01");
  return (
    <div className="w-80">
      <DatePickerField label="Tanggal Pembayaran" value={value} onChange={setValue} required />
    </div>
  );
}

export const Default: Story = {
  render: () => <DatePickerDemo />,
};
