import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { FormField, TextInput } from "./basic-form-controls";
import { OperationalFormSheet } from "./guided-form";

function Demo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("Pembelian Semen");
  return (
    <div className="h-140 w-full">
      <OperationalFormSheet
        dismissal={{ mode: "discard" }}
        open={open}
        title="Catat Pengeluaran"
        submitLabel="Simpan"
        statusItems={[{ label: "Total", amount: 6400000 }]}
        onClose={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
      >
        <FormField label="Nama Item" required>
          <TextInput value={name} onChange={setName} />
        </FormField>
      </OperationalFormSheet>
    </div>
  );
}

const meta = {
  title: "ui/form/OperationalFormSheet",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
