import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { MediaPreviewDialog } from "./media-preview-dialog";

const receipt = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000"><rect width="700" height="1000" fill="white"/><g fill="black" font-family="monospace" font-size="26"><text x="60" y="90">BUKTI PRATINJAU · SINTETIS</text><text x="60" y="140">17 Oktober 2026</text><text x="60" y="230">Material panel       2 lembar</text><text x="60" y="280">Harga                Rp 123.456,75</text><text x="60" y="390">TOTAL                Rp 246.913,50</text><text x="60" y="900">Hanya contoh Storybook</text></g></svg>')}`;

function Demo({
  purpose = "image",
  unavailable = false,
}: {
  readonly purpose?: "image" | "document";
  readonly unavailable?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka pratinjau</Button>
      <MediaPreviewDialog
        open={open}
        title="Pratinjau nota"
        purpose={purpose}
        imageUrl={unavailable ? "/missing-preview-audit.png" : receipt}
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

export const Document: Story = { render: () => <Demo purpose="document" /> };
export const Unavailable: Story = { render: () => <Demo purpose="document" unavailable /> };
