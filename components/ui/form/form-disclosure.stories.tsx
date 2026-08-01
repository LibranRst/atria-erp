import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { FieldContextLine, FormDisclosure } from "./guided-form";

function Demo(): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="w-80">
      <FormDisclosure
        title="Rincian Perhitungan"
        description="Lihat detail margin dan pajak"
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      >
        <div className="space-y-2 p-3">
          <FieldContextLine>Margin: 14.2%</FieldContextLine>
          <FieldContextLine tone="warning">PPN belum termasuk</FieldContextLine>
        </div>
      </FormDisclosure>
    </div>
  );
}

const meta = {
  title: "ui/form/FormDisclosure",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  render: () => <Demo />,
};
