import type { Meta, StoryObj } from "@storybook/nextjs";
import { useRef, useState } from "react";

import type { FabAction } from "./bottom-nav-config";
import { QuickActionFab } from "./bottom-nav-parts";

const fabActions: readonly FabAction[] = [
  {
    label: "Expense Lapangan",
    description: "Klaim biaya proyek",
    iconName: "receipt_long",
    href: "/expenses?new-expense=true",
  },
  {
    label: "Tagihan Vendor",
    description: "Invoice supplier",
    iconName: "request_quote",
    href: "/expenses?new-vendor-bill=true",
  },
  {
    label: "Project Baru",
    description: "Buat workspace",
    iconName: "folder_open",
    href: "/projects?new-project=true",
    disabled: true,
  },
];

function Demo({ isOpen }: { readonly isOpen: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(isOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-80 w-80">
      <QuickActionFab
        actions={fabActions}
        contentRef={contentRef}
        isOpen={open}
        menuHeight={open ? 220 : null}
        onAction={() => setOpen(false)}
        onOpen={() => setOpen(true)}
      />
    </div>
  );
}

const meta = {
  title: "layout/QuickActionFab",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  render: () => <Demo isOpen={false} />,
};

export const Open: Story = {
  render: () => <Demo isOpen />,
};
