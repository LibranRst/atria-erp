import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { MediaPreviewDialog } from "./media-preview-dialog";

function Demo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka pratinjau</Button>
      <MediaPreviewDialog
        open={open}
        title="Pratinjau nota"
        imageUrl="/favicon.ico"
        alt="Nota pengeluaran"
        caption="Gambar bukti pengeluaran"
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const meta = {
  title: "ui/overlay/MediaPreviewDialog",
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
