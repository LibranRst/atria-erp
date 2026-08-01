import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { SwitchRow } from "./basic-form-controls";

function Demo(): React.JSX.Element {
  const [checked, setChecked] = useState(true);
  return (
    <div className="w-80 bg-white p-2">
      <SwitchRow
        checked={checked}
        onChange={setChecked}
        title="Notifikasi Persetujuan"
        description="Kirim notifikasi saat ada pengajuan baru"
      />
    </div>
  );
}

const meta = {
  title: "ui/form/SwitchRow",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
