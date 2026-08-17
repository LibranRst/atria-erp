import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { FormField, TextInput } from "./basic-form-controls";

function Demo(props: {
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly helper?: string;
  readonly error?: string;
  readonly readOnly?: boolean;
}): React.JSX.Element {
  const [value, setValue] = useState("Renovasi Rumah Jl. Kenanga");
  return (
    <div className="w-80">
      <FormField label="Nama Proyek" {...props}>
        <TextInput value={value} onChange={setValue} readOnly={props.readOnly} />
      </FormField>
    </div>
  );
}

const meta = {
  title: "ui/form/FormField",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo required />,
};

export const WithHelper: Story = {
  render: () => <Demo optional helper="Opsional, maksimal 60 karakter" />,
};

export const WithError: Story = {
  render: () => <Demo required error="Nama proyek wajib diisi." />,
};

export const ReadOnly: Story = {
  render: () => <Demo readOnly />,
};
