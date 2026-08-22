import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { IconButton } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { ActionMenu, ContextPopover } from "./anchored-surfaces";

function AnchoredSurfacesDemo(): React.JSX.Element {
  const [lastAction, setLastAction] = useState("Belum ada aksi");
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 bg-background p-8">
      <div className="flex items-center justify-center gap-4">
        <ActionMenu
          label="Aksi percakapan"
          trigger={
            <IconButton
              label="Aksi percakapan"
              icon={<AppIcon name="more_horiz" className="icon-md" />}
            />
          }
          items={[
            {
              id: "rename",
              label: "Ganti judul…",
              icon: "edit",
              onSelect: () => setLastAction("Ganti judul dipilih"),
            },
            {
              id: "delete",
              label: "Hapus percakapan…",
              icon: "delete",
              tone: "critical",
              onSelect: () => setLastAction("Hapus dipilih"),
            },
          ]}
        />
        <ContextPopover
          label="Tentang status budget"
          trigger={
            <IconButton
              label="Tentang status budget"
              icon={<AppIcon name="info" className="icon-md" />}
            />
          }
        >
          <p className="text-row font-bold text-on-surface">Status budget</p>
          <p className="mt-1 text-support text-on-surface-variant">
            Pemakaian dihitung dari biaya aktual terhadap alokasi kategori.
          </p>
        </ContextPopover>
      </div>
      <p role="status" className="text-meta font-semibold text-on-surface-variant">
        {lastAction}
      </p>
    </div>
  );
}

const meta = {
  title: "ui/overlay/AnchoredSurfaces",
  component: AnchoredSurfacesDemo,
} satisfies Meta<typeof AnchoredSurfacesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
