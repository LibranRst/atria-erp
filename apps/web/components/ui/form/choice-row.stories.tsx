import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { ChoiceRow } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [checked, setChecked] = useState(true);
  return (
    <div className="w-80">
      <ChoiceRow
        checked={checked}
        onChange={setChecked}
        title="Tunai"
        description="Pembayaran langsung di lokasi"
      />
    </div>
  );
}

const meta = {
  title: "ui/form/ChoiceRow",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};

function ReviewDemo(): React.JSX.Element {
  const [checked, setChecked] = useState(true);
  return (
    <ChoiceRow
      presentation="review"
      title="Pilih panel laminasi"
      checked={checked}
      onChange={setChecked}
    />
  );
}
export const ReviewSelection: Story = { render: () => <ReviewDemo /> };
