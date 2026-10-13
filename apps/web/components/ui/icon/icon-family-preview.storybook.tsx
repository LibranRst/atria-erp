"use client";

import { useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import Folder01Icon from "@hugeicons/core-free-icons/Folder01Icon";
import Wallet01Icon from "@hugeicons/core-free-icons/Wallet01Icon";
import Invoice01Icon from "@hugeicons/core-free-icons/Invoice01Icon";
import CheckmarkBadge01Icon from "@hugeicons/core-free-icons/CheckmarkBadge01Icon";
import PackageIcon from "@hugeicons/core-free-icons/PackageIcon";
import HammerIcon from "@hugeicons/core-free-icons/HammerIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";

import {
  AppIcon,
  Button,
  GroupedSurface,
  IconButton,
  RowGroup,
  SegmentedTabs,
  type AppIconName,
} from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { IconTileFrame } from "./icon-tile";
import { PhosphorReference } from "./phosphor-reference.storybook";

type IconFamily = "phosphor" | "hugeicons";
type PreviewView = "sizes" | "context";
type PreviewSize = 18 | 20 | 24;
type PreviewIcon = {
  readonly label: string;
  readonly name: AppIconName;
  readonly candidate: IconSvgElement;
};

export const previewIcons: readonly PreviewIcon[] = [
  { label: "Dashboard", name: "dashboard", candidate: DashboardSquare01Icon },
  { label: "Proyek", name: "folder", candidate: Folder01Icon },
  { label: "Dompet", name: "account_balance_wallet", candidate: Wallet01Icon },
  { label: "Pengeluaran", name: "receipt_long", candidate: Invoice01Icon },
  { label: "Approval", name: "verified", candidate: CheckmarkBadge01Icon },
  { label: "Stok", name: "inventory", candidate: PackageIcon },
  { label: "Tukang", name: "construction", candidate: HammerIcon },
  { label: "Pengaturan", name: "tune", candidate: Settings01Icon },
];

const sizes: readonly PreviewSize[] = [18, 20, 24];
const sizeClass: Record<PreviewSize, string> = { 18: "icon-md", 20: "icon-lg", 24: "icon-xl" };
const familyLabels: Record<IconFamily, string> = { phosphor: "Phosphor", hugeicons: "Hugeicons" };
const families: readonly IconFamily[] = ["phosphor", "hugeicons"];

function PreviewGlyph({
  item,
  family,
  size = 20,
  selected = false,
}: {
  readonly item: PreviewIcon;
  readonly family: IconFamily;
  readonly size?: PreviewSize;
  readonly selected?: boolean;
}): React.JSX.Element {
  return family === "phosphor" ? (
    <PhosphorReference
      name={item.name}
      weight={selected ? "fill" : "regular"}
      className={sizeClass[size]}
    />
  ) : (
    <HugeiconsIcon icon={item.candidate} size={size} strokeWidth={1.5} aria-hidden="true" />
  );
}

function SizeGallery(): React.JSX.Element {
  return (
    <GroupedSurface>
      <RowGroup>
        {previewIcons.map((item) => (
          <section key={item.name} aria-label={item.label} className="space-y-2 p-4">
            <h2 className="text-sm font-semibold">{item.label}</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {families.map((family) => (
                <div
                  key={family}
                  className="grid grid-cols-[minmax(0,1fr)_repeat(3,40px)] items-center gap-2"
                >
                  <span className="text-xs text-on-surface-variant">{familyLabels[family]}</span>
                  {sizes.map((size) => (
                    <div
                      key={size}
                      className="flex flex-col items-center gap-1"
                      aria-label={`${familyLabels[family]} ${item.label}, ${size} piksel`}
                    >
                      <span className="flex h-8 items-center">
                        <PreviewGlyph item={item} family={family} size={size} />
                      </span>
                      <span className="text-xs text-on-surface-variant tabular-nums">{size}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </RowGroup>
    </GroupedSurface>
  );
}

function ContextPreview({
  family,
  activeName,
  onSelect,
}: {
  readonly family: IconFamily;
  readonly activeName: AppIconName;
  readonly onSelect: (name: AppIconName) => void;
}): React.JSX.Element {
  const navigation = previewIcons.filter((item) =>
    ["dashboard", "folder", "inventory", "receipt_long"].includes(item.name),
  );
  const rows = previewIcons.filter((item) =>
    ["account_balance_wallet", "verified", "construction", "tune"].includes(item.name),
  );
  return (
    <section aria-label={`Konteks ${familyLabels[family]}`} className="min-w-0 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{familyLabels[family]}</h2>
        <p className="text-sm text-on-surface-variant">
          {family === "phosphor"
            ? "Phosphor sebelum migrasi"
            : "Ikon Atria · Stroke Rounded · gratis · stroke 1.5"}
        </p>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sidebar desktop</h3>
        <WorkspacePresentationProvider presentation="desktop">
          <GroupedSurface className="w-full max-w-64 p-3" variant="desktopPanel">
            <nav
              aria-label={`Sidebar ${familyLabels[family]}`}
              className="space-y-1"
              data-atria-admin
            >
              {previewIcons.map((item) => (
                <Button
                  key={item.name}
                  variant={activeName === item.name ? "primary" : "quiet"}
                  size="compact"
                  fullWidth
                  className={
                    activeName === item.name
                      ? "justify-start bg-primary! text-on-surface-inverse! shadow-primary!"
                      : "justify-start bg-transparent! text-on-surface-variant! shadow-none! hover:bg-surface-container-low!"
                  }
                  aria-pressed={activeName === item.name}
                  leadingIcon={<PreviewGlyph item={item} family={family} size={18} />}
                  onClick={() => onSelect(item.name)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          </GroupedSurface>
        </WorkspacePresentationProvider>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Navigasi web mobile</h3>
        <WorkspacePresentationProvider presentation="mobile">
          <nav
            aria-label={`Navigasi mobile ${familyLabels[family]}`}
            className="flex w-fit max-w-full items-center gap-1 rounded-full bg-surface-container-lowest p-2 shadow-raised"
          >
            {navigation.map((item) => (
              <IconButton
                key={item.name}
                label={item.label}
                icon={
                  <PreviewGlyph
                    item={item}
                    family={family}
                    size={24}
                    selected={activeName === item.name}
                  />
                }
                variant={activeName === item.name ? "primary" : "quiet"}
                aria-pressed={activeName === item.name}
                onClick={() => onSelect(item.name)}
              />
            ))}
          </nav>
        </WorkspacePresentationProvider>
        <p className="text-xs text-on-surface-variant">Dock native iOS tetap memakai SF Symbols.</p>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Baris operasional</h3>
        <GroupedSurface>
          <RowGroup>
            {rows.map((item) => (
              <div key={item.name} className="flex items-center gap-3 p-4">
                {family === "phosphor" ? (
                  <IconTileFrame>
                    <PhosphorReference name={item.name} weight="duotone" className="icon-lg" />
                  </IconTileFrame>
                ) : (
                  <IconTileFrame>
                    <PreviewGlyph item={item} family={family} />
                  </IconTileFrame>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-on-surface-variant">
                    {item.name === "verified" ? "Menunggu persetujuan" : "Contoh tampilan"}
                  </p>
                </div>
                <IconButton
                  label={`Buka ${item.label.toLowerCase()}`}
                  size="compact"
                  variant="quiet"
                  icon={<AppIcon name="chevron_right" className="icon-md" />}
                  onClick={() => onSelect(item.name)}
                />
              </div>
            ))}
          </RowGroup>
        </GroupedSurface>
      </div>
      <p className="text-sm text-on-surface-variant" role="status">
        Pilihan aktif: {previewIcons.find((item) => item.name === activeName)?.label}
      </p>
    </section>
  );
}

export function IconFamilyPreview(): React.JSX.Element {
  const [view, setView] = useState<PreviewView>("sizes");
  const [activeName, setActiveName] = useState<AppIconName>("dashboard");
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" aria-label="Perbandingan ikon Atria">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Phosphor vs Hugeicons</h1>
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Delapan fungsi Atria, dengan ukuran dan konteks yang sama. Phosphor mempertahankan
          pembesaran 110% yang dipakai app sekarang.
        </p>
      </header>
      <SegmentedTabs
        value={view}
        onChange={setView}
        ariaLabel="Tampilan perbandingan ikon"
        options={[
          { value: "sizes", label: "Ukuran ikon" },
          { value: "context", label: "Dalam UI" },
        ]}
        layoutId="icon-family-preview"
      />
      {view === "sizes" ? (
        <SizeGallery />
      ) : (
        <div className="grid items-start gap-8 md:grid-cols-2">
          {families.map((family) => (
            <ContextPreview
              key={family}
              family={family}
              activeName={activeName}
              onSelect={setActiveName}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-on-surface-variant">
        Hugeicons sekarang dipakai di UI Atria. Phosphor di sini hanya referensi sebelumnya.
      </p>
    </main>
  );
}
