import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { QuantityStepper } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("12");
  return (
    <div className="w-80">
      <QuantityStepper value={value} onChange={setValue} unit="sak" />
    </div>
  );
}

const meta = {
  title: "ui/form/QuantityStepper",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
