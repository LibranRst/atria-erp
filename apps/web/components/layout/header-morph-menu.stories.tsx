import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import type { HeaderMenuItem } from "./header-menu-config";
import { HeaderMorphMenu } from "./header-morph-menu";

const meta = {
  title: "layout/HeaderMorphMenu",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const items: readonly HeaderMenuItem[] = [
  {
    label: "Dashboard",
    href: "/ledger",
    iconName: "dashboard",
    match: (path) => path === "/ledger",
  },
  {
    label: "Proyek",
    href: "/projects",
    iconName: "folder",
    match: (path) => path.startsWith("/projects"),
  },
  {
    label: "Kas & Tagihan",
    href: "/expenses",
    iconName: "receipt_long",
    match: (path) => path.startsWith("/expenses"),
  },
  {
    label: "Persetujuan",
    href: "/approvals",
    iconName: "verified_user",
    match: (path) => path.startsWith("/approvals"),
  },
];

function Demo({ initialOpen }: { readonly initialOpen: boolean }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <div className="flex h-64 w-64 items-start justify-center pt-2">
      <HeaderMorphMenu
        isOpen={isOpen}
        items={items}
        pathname="/expenses"
        searchParams={new URLSearchParams()}
        title="Kas & Tagihan"
        onToggle={() => setIsOpen((current) => !current)}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

export const Closed: Story = {
  render: () => <Demo initialOpen={false} />,
};

export const Open: Story = {
  render: () => <Demo initialOpen />,
};
