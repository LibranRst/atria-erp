import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { MoneyInput } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("6400000");
  return (
    <div className="w-80">
      <MoneyInput value={value} onChange={setValue} />
    </div>
  );
}

const meta = {
  title: "ui/form/MoneyInput",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
