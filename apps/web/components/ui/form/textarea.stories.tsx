import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Textarea } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState(
    "Pembelian material tahap 2 untuk area dapur dan kamar mandi.",
  );
  return (
    <div className="w-80">
      <Textarea value={value} onChange={setValue} />
    </div>
  );
}

const meta = {
  title: "ui/form/Textarea",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
