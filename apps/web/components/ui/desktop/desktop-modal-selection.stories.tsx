import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";

import {
  ActionMenu,
  AdaptiveSelect,
  Button,
  ComboboxField,
  CompactFormDialog,
  ConfirmationDialog,
  ContextPopover,
  DesktopUIProvider,
  FilterSelect,
  FormField,
  FormSection,
  FormSheet,
  SheetFooterActions,
  TextInput,
  type SelectOption,
} from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";

type Scenario =
  | "normal"
  | "search"
  | "empty-create"
  | "empty-custom"
  | "filter"
  | "search-filter"
  | "action-menu"
  | "confirmation"
  | "context-popover"
  | "empty-normal"
  | "late-options";

const normalOptions: readonly SelectOption[] = [
  { value: "", label: "Tanpa vendor" },
  { value: "supplier-1", label: "Supplier panel contoh", description: "Panel dan finishing" },
  { value: "supplier-2", label: "Supplier perlengkapan contoh", meta: "6 material" },
  {
    value: "archived",
    label: "Supplier diarsipkan",
    disabled: true,
    disabledReason: "Referensi sudah diarsipkan",
  },
];
const searchOptions: readonly SelectOption[] = [
  ...normalOptions,
  ...Array.from({ length: 10 }, (_, index): SelectOption => ({
    value: `reference-${index + 1}`,
    label: `Referensi material ${index + 1}`,
    description: `Lokasi contoh ${index + 1}`,
    group: "Referensi aktif",
  })),
];

function ModalSelectionFixture({
  scenario = "normal",
  nativeFallback = false,
}: {
  readonly scenario?: Scenario;
  readonly nativeFallback?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const startsEmpty = ["empty-create", "empty-normal", "late-options"].includes(scenario);
  const [outerOpen, setOuterOpen] = React.useState(true);
  const [innerOpen, setInnerOpen] = React.useState(true);
  const [value, setValue] = React.useState("");
  const [draft, setDraft] = React.useState("Catatan item contoh");
  const [options, setOptions] = React.useState<readonly SelectOption[]>(
    startsEmpty
      ? []
      : scenario === "search" || scenario === "search-filter"
        ? searchOptions
        : normalOptions,
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [compactOpen, setCompactOpen] = React.useState(false);
  const [createdName, setCreatedName] = React.useState("");
  const [confirmationOpen, setConfirmationOpen] = React.useState(false);
  const [pendingValue, setPendingValue] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [selections, setSelections] = React.useState(0);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? (value || "Belum dipilih");

  function choose(next: string): void {
    setValue(next);
    setSelections((count) => count + 1);
    setNotice("Pilihan draft diperbarui di fixture ini.");
  }

  function saveReference(): void {
    const name = createdName.trim();
    if (!name) return;
    const reference: SelectOption = { value: "created-reference", label: name };
    setOptions((current) => [
      ...current.filter((option) => option.value !== reference.value),
      reference,
    ]);
    choose(reference.value);
    setCreateOpen(false);
    setCompactOpen(false);
    setNotice("Referensi contoh ditambahkan dalam memori. Tidak ada data disimpan.");
  }

  function openCreate(): void {
    setCreatedName("");
    setCreateOpen(true);
  }

  function renderSelection(): React.JSX.Element {
    if (scenario === "empty-custom")
      return (
        <ComboboxField
          id="nested-custom-unit"
          label="Satuan kustom"
          value={value}
          options={[]}
          onChange={choose}
          allowCustomValue
          emptyText="Belum ada satuan tersimpan. Ketik satuan baru."
        />
      );

    if (scenario === "filter" || scenario === "search-filter")
      return (
        <FilterSelect
          label="Filter referensi"
          value={value}
          options={options}
          onChange={choose}
          searchable={scenario === "search-filter"}
        />
      );

    if (scenario === "action-menu")
      return (
        <div className="px-4 py-3">
          <ActionMenu
            label="Aksi referensi contoh"
            trigger={<Button variant="secondary">Aksi referensi</Button>}
            items={[
              {
                id: "add-reference",
                label: "Tambah referensi contoh",
                icon: "add",
                onSelect: (): void => {
                  setCreatedName("");
                  setCompactOpen(true);
                },
              },
              {
                id: "unavailable",
                label: "Aksi belum tersedia",
                disabledReason: "Contoh tindakan yang dinonaktifkan",
                onSelect: (): void => setNotice("Tindakan nonaktif tidak boleh dijalankan."),
              },
            ]}
          />
        </div>
      );

    if (scenario === "context-popover")
      return (
        <div className="px-4 py-3">
          <ContextPopover
            label="Konteks referensi contoh"
            trigger={<Button variant="secondary">Buka konteks pilihan</Button>}
          >
            <FormSection title="Referensi di popover">
              <AdaptiveSelect
                id="context-vendor-choice"
                label="Vendor dalam popover"
                value={value}
                options={options}
                onChange={choose}
                optional
              />
            </FormSection>
          </ContextPopover>
        </div>
      );

    return (
      <AdaptiveSelect
        id="nested-vendor-choice"
        label={scenario === "empty-create" ? "Kategori baru" : "Vendor contoh"}
        value={value}
        options={options}
        onChange={(next): void => {
          if (scenario === "confirmation") {
            setPendingValue(next);
            setConfirmationOpen(true);
          } else choose(next);
        }}
        optional
        presentation={scenario === "search" ? "dialog" : "auto"}
        emptyText="Belum ada referensi contoh."
        createActionLabel={scenario === "empty-create" ? "Tambah kategori contoh" : undefined}
        createActionDescription={
          scenario === "empty-create" ? "Buka form referensi baru." : undefined
        }
        onCreateAction={scenario === "empty-create" ? openCreate : undefined}
      />
    );
  }

  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <div className="min-h-screen bg-background p-6">
          <Button
            onClick={(): void => {
              setOuterOpen(true);
              setInnerOpen(true);
            }}
          >
            Buka dua modal contoh
          </Button>
          <FormSheet
            open={outerOpen}
            title="Form pengeluaran contoh"
            desktopSize="wide"
            dismissal={{ mode: "discard" }}
            onClose={(): void => {
              setOuterOpen(false);
              setInnerOpen(false);
            }}
          >
            <FormSection
              title="Data pengeluaran"
              helper="Fixture aman; semua pilihan hanya disimpan dalam memori."
            >
              <FormField label="Keterangan pengeluaran">
                <TextInput value="Pengeluaran contoh" readOnly />
              </FormField>
              <div className="px-4 py-3">
                <Button variant="secondary" onClick={(): void => setInnerOpen(true)}>
                  Buka rincian item
                </Button>
              </div>
            </FormSection>
            <FormSheet
              open={innerOpen}
              title="Rincian item contoh"
              desktopSize="wide"
              desktopFooterPlacement="aside"
              desktopAsideSummary={
                <div className="space-y-2 text-support text-on-surface-variant">
                  <p data-testid="selected-value">Pilihan: {selectedLabel}</p>
                  <p data-testid="selection-count">Perubahan pilihan: {selections}</p>
                  <p role="status">{notice || "Tidak ada perubahan pada database."}</p>
                </div>
              }
              footer={
                <SheetFooterActions
                  primary={{ label: "Selesai", onClick: (): void => setInnerOpen(false) }}
                />
              }
              dismissal={{ mode: "discard" }}
              onClose={(): void => setInnerOpen(false)}
            >
              <FormSection
                title="Informasi item"
                helper="Uji pilihan di atas dua modal yang tetap terbuka."
              >
                {renderSelection()}
                <FormField label="Catatan item">
                  <TextInput id="nested-item-draft" value={draft} onChange={setDraft} />
                </FormField>
              </FormSection>
              {scenario === "late-options" ? (
                <div className="px-1 pt-3">
                  <Button variant="secondary" onClick={(): void => setOptions(normalOptions)}>
                    Muat pilihan contoh
                  </Button>
                </div>
              ) : null}
              <FormSheet
                open={createOpen}
                title="Kategori contoh baru"
                dismissal={{ mode: "discard" }}
                onClose={(): void => setCreateOpen(false)}
                footer={
                  <SheetFooterActions
                    primary={{
                      label: "Simpan contoh",
                      disabled: !createdName.trim(),
                      onClick: saveReference,
                    }}
                  />
                }
              >
                <FormSection title="Identitas kategori">
                  <FormField label="Nama kategori" required>
                    <TextInput
                      id="created-reference-name"
                      value={createdName}
                      onChange={setCreatedName}
                      autoFocus
                    />
                  </FormField>
                </FormSection>
              </FormSheet>
              <CompactFormDialog
                open={compactOpen}
                title="Referensi contoh baru"
                onClose={(): void => setCompactOpen(false)}
                actions={
                  <SheetFooterActions
                    primary={{
                      label: "Simpan referensi contoh",
                      disabled: !createdName.trim(),
                      onClick: saveReference,
                    }}
                    secondary={{ label: "Batal", onClick: (): void => setCompactOpen(false) }}
                  />
                }
              >
                <FormField label="Nama referensi" required>
                  <TextInput
                    id="compact-reference-name"
                    value={createdName}
                    onChange={setCreatedName}
                    autoFocus
                  />
                </FormField>
              </CompactFormDialog>
              <ConfirmationDialog
                open={confirmationOpen}
                title="Ubah vendor contoh?"
                description="Pilihan hanya diperbarui setelah konfirmasi. Data database tetap sama."
                confirmLabel="Terapkan contoh"
                onClose={(): void => setConfirmationOpen(false)}
                onConfirm={(): void => {
                  choose(pendingValue);
                  setConfirmationOpen(false);
                }}
              />
            </FormSheet>
          </FormSheet>
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "ui/desktop/ModalSelection",
  component: ModalSelectionFixture,
} satisfies Meta<typeof ModalSelectionFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = { args: { scenario: "normal" } };
export const Search: Story = { args: { scenario: "search" } };
export const EmptyCreate: Story = { args: { scenario: "empty-create" } };
export const EmptyCustom: Story = { args: { scenario: "empty-custom" } };
export const Filter: Story = { args: { scenario: "filter" } };
export const SearchFilter: Story = { args: { scenario: "search-filter" } };
export const ActionMenuOpensForm: Story = { args: { scenario: "action-menu" } };
export const SelectionOpensConfirmation: Story = { args: { scenario: "confirmation" } };
export const NestedContextPopover: Story = { args: { scenario: "context-popover" } };
export const EmptyNormal: Story = { args: { scenario: "empty-normal" } };
export const LateOptions: Story = { args: { scenario: "late-options" } };
export const NativeFallback: Story = { args: { scenario: "normal", nativeFallback: true } };
