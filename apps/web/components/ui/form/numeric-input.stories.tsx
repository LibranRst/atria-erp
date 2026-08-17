import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { NumericInput } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("40");
  return (
    <div className="w-80">
      <NumericInput value={value} onChange={setValue} suffix="sak" />
    </div>
  );
}

const meta = {
  title: "ui/form/NumericInput",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
