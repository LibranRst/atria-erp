import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { SearchInput } from "./select-form-controls";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("semen");
  return (
    <div className="w-80">
      <SearchInput value={value} onChange={setValue} placeholder="Cari material..." />
    </div>
  );
}

const meta = {
  title: "ui/form/SearchInput",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
