import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { TextInput } from "../form/basic-form-controls";
import { FormField } from "../form/basic-form-controls";
import { DialogOptionList } from "../form/dialog-option-list";
import { SheetFooterActions } from "./sheet-footer-actions";
import {
  CalendarDialog,
  CompactFormDialog,
  ConfirmationDialog,
  SearchDialog,
  SelectionDialog,
  SuccessDialog,
} from "./dialogs";

const optionExamples = [
  {
    value: "MATERIAL",
    label: "Material",
    description: "Barang dan bahan proyek",
    group: "Biaya utama",
  },
  {
    value: "TUKANG",
    label: "Tukang",
    description: "Upah dan paket pekerjaan",
    group: "Biaya utama",
  },
  {
    value: "OPERASIONAL",
    label: "Operasional lapangan dan kebutuhan pendukung",
    description: "Transportasi, konsumsi, dan kebutuhan harian",
    group: "Biaya pendukung",
  },
  {
    value: "SUBCON",
    label: "Subkontraktor",
    disabled: true,
    disabledReason: "Belum tersedia untuk proyek ini.",
    group: "Biaya pendukung",
  },
] as const;

function DialogGallery(): React.JSX.Element {
  const [compactOpen, setCompactOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("MATERIAL");
  const [name, setName] = useState("Percakapan budget Agustus");

  return (
    <div className="flex min-h-72 flex-wrap items-center justify-center gap-2 bg-background p-6">
      <Button variant="secondary" onClick={() => setCompactOpen(true)}>
        Compact form
      </Button>
      <Button variant="secondary" onClick={() => setConfirmationOpen(true)}>
        Confirmation
      </Button>
      <Button variant="secondary" onClick={() => setSuccessOpen(true)}>
        Success
      </Button>
      <Button variant="secondary" onClick={() => setSelectionOpen(true)}>
        Selection
      </Button>
      <Button variant="secondary" onClick={() => setSearchOpen(true)}>
        Search
      </Button>
      <Button variant="secondary" onClick={() => setCalendarOpen(true)}>
        Calendar
      </Button>

      <CompactFormDialog
        open={compactOpen}
        title="Ganti judul"
        actions={
          <SheetFooterActions
            secondary={{ label: "Batal", onClick: () => setCompactOpen(false) }}
            primary={{ label: "Simpan", onClick: () => setCompactOpen(false) }}
          />
        }
        onClose={() => setCompactOpen(false)}
      >
        <FormField label="Judul percakapan">
          <TextInput autoFocus value={name} onChange={setName} />
        </FormField>
      </CompactFormDialog>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Hapus percakapan?"
        description="Riwayat chat akan dihapus dan tidak dapat dipulihkan."
        confirmLabel="Hapus"
        danger
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => setConfirmationOpen(false)}
      />

      <SuccessDialog
        open={successOpen}
        title="Pembayaran tercatat"
        description="Saldo rekening dan status invoice sudah diperbarui."
        facts={[
          { label: "Nominal", value: "Rp 12.500.000" },
          { label: "Rekening", value: "BCA Operasional" },
          { label: "Status", value: "Sudah diposting" },
        ]}
        onClose={() => setSuccessOpen(false)}
      />

      <SelectionDialog
        open={selectionOpen}
        title="Pilih kategori"
        description="Kategori menentukan budget yang digunakan."
        onClose={() => setSelectionOpen(false)}
      >
        <DialogOptionList
          label="Kategori biaya"
          value={selected}
          options={optionExamples}
          emptyText="Belum ada kategori."
          onSelect={(option) => {
            setSelected(option.value);
            setSelectionOpen(false);
          }}
        />
      </SelectionDialog>

      <SearchDialog
        open={searchOpen}
        title="Pilih kategori"
        description="Cari kategori yang paling sesuai."
        query={query}
        onQueryChange={setQuery}
        onClose={() => setSearchOpen(false)}
      >
        <DialogOptionList
          label="Kategori biaya"
          value={selected}
          options={optionExamples.filter((option) =>
            option.label.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")),
          )}
          emptyText="Kategori tidak ditemukan."
          animateHeight
          onSelect={(option) => {
            setSelected(option.value);
            setSearchOpen(false);
          }}
        />
      </SearchDialog>

      <CalendarDialog
        open={calendarOpen}
        title="Pilih tanggal"
        onClose={() => setCalendarOpen(false)}
      >
        <div className="grid grid-cols-7 gap-1 text-center">
          {[18, 19, 20, 21, 22, 23, 24].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setCalendarOpen(false)}
              className="flex aspect-square items-center justify-center rounded-full text-xs font-bold text-on-surface hover:bg-surface-container-low"
            >
              {day}
            </button>
          ))}
        </div>
      </CalendarDialog>
    </div>
  );
}

function SelectionDialogPreview(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("MATERIAL");
  return (
    <div className="min-h-96 bg-background p-6">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka selection
      </Button>
      <SelectionDialog
        open={open}
        title="Pilih kategori"
        description="Kategori menentukan budget yang digunakan."
        onClose={() => setOpen(false)}
      >
        <DialogOptionList
          label="Kategori biaya"
          value={selected}
          options={optionExamples}
          emptyText="Belum ada kategori."
          onSelect={(option) => {
            setSelected(option.value);
            setOpen(false);
          }}
        />
      </SelectionDialog>
    </div>
  );
}

function SearchDialogPreview(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  return (
    <div className="min-h-96 bg-background p-6">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka search
      </Button>
      <SearchDialog
        open={open}
        title="Cari kategori"
        description="Pilih kategori yang paling sesuai."
        query={query}
        onQueryChange={setQuery}
        onClose={() => setOpen(false)}
      >
        <DialogOptionList
          label="Kategori biaya"
          value="MATERIAL"
          options={optionExamples.filter((option) =>
            option.label.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")),
          )}
          emptyText="Kategori tidak ditemukan."
          onSelect={() => setOpen(false)}
        />
      </SearchDialog>
    </div>
  );
}

const meta = {
  title: "ui/overlay/ContextualDialogs",
  component: DialogGallery,
} satisfies Meta<typeof DialogGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SelectionEdgeToEdge: Story = {
  render: () => <SelectionDialogPreview />,
};

export const SearchEdgeToEdge: Story = {
  render: () => <SearchDialogPreview />,
};
