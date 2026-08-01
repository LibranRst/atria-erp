import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { TextInput } from "./basic-form-controls";

function Demo(props: { readonly initial?: string; readonly disabled?: boolean }): React.JSX.Element {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <div className="w-80">
      <TextInput
        value={value}
        onChange={setValue}
        disabled={props.disabled}
        placeholder="Masukkan nama proyek"
      />
    </div>
  );
}

const meta = {
  title: "ui/form/TextInput",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  render: () => <Demo initial="Renovasi Rumah Jl. Kenanga" />,
};

export const Empty: Story = {
  render: () => <Demo />,
};

export const Disabled: Story = {
  render: () => <Demo initial="Renovasi Rumah" disabled />,
};
