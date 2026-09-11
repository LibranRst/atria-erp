import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { WorkflowFormSheet } from "./guided-form";

function Demo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-120 w-full">
      <WorkflowFormSheet
        dismissal={{ mode: "discard" }}
        open={open}
        title="Setujui Pengajuan"
        primaryLabel="Setujui"
        secondaryLabel="Tolak"
        statusText="Menunggu keputusan Owner"
        onClose={() => setOpen(false)}
        onPrimary={() => setOpen(false)}
        onSecondary={() => setOpen(false)}
      >
        <p className="text-sm text-on-surface-variant">
          Pengajuan pembayaran vendor senilai Rp 8.200.000 menunggu persetujuan Anda.
        </p>
      </WorkflowFormSheet>
    </div>
  );
}

const meta = {
  title: "ui/form/WorkflowFormSheet",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};
