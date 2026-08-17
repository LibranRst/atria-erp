import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { OptionChoiceGroup } from "./guided-form";

function Demo(): React.JSX.Element {
  const [value, setValue] = useState<"cash" | "transfer">("transfer");
  return (
    <div className="w-80">
      <OptionChoiceGroup
        label="Metode Pembayaran"
        value={value}
        onChange={setValue}
        options={[
          { value: "cash", label: "Tunai", description: "Dibayar langsung di lokasi" },
          { value: "transfer", label: "Transfer Bank", description: "Melalui rekening perusahaan" },
        ]}
      />
    </div>
  );
}

const meta = {
  title: "ui/form/OptionChoiceGroup",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
