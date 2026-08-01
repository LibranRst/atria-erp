import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { ComboboxField } from "./select-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("Kitchen");
  return (
    <div className="w-80">
      <ComboboxField
        label="Ruangan"
        value={value}
        options={["Kitchen", "Living Room", "Bedroom", "Bathroom"]}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "ui/form/ComboboxField",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
