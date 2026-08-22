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

function Demo({
  initialOpen,
  pathname = "/expenses",
  title = "Kas & Tagihan",
}: {
  readonly initialOpen: boolean;
  readonly pathname?: string;
  readonly title?: string;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <div className="flex h-96 w-80 items-start justify-center pt-2">
      <HeaderMorphMenu
        isOpen={isOpen}
        items={items}
        pathname={pathname}
        searchParams={new URLSearchParams()}
        title={title}
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

/**
 * Judul pendek. Rumus lama memaksanya ke lantai 124px — sekitar 42px lebih lebar
 * daripada tulisannya sendiri. Sekarang lebarnya diukur.
 */
export const ShortTitle: Story = {
  render: () => <Demo initialOpen={false} pathname="/projects" title="Proyek" />,
};

/** Judul terpanjang yang ada, sebagai batas atas. */
export const LongTitle: Story = {
  render: () => <Demo initialOpen={false} pathname="/settings" title="Kategori Pengeluaran" />,
};

/**
 * Rute yang bukan salah satu tujuan menu. Tidak ada baris yang disorot, dan
 * judulnya memudar di tempat alih-alih melayang ke baris yang keliru.
 */
export const NoActiveRoute: Story = {
  render: () => <Demo initialOpen pathname="/rute-lain" title="Halaman Lain" />,
};
