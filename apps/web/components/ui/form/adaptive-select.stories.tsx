import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { FormSheet } from "../overlay/semantic-sheets";
import type { SelectOption } from "./form-control-types";
import { AdaptiveSelect } from "./select-form-controls";

const categoryOptions: readonly SelectOption[] = [
  { value: "material", label: "Material", description: "Semen, cat, keramik" },
  { value: "labor", label: "Tenaga Kerja" },
  { value: "overhead", label: "Overhead" },
  { value: "contingency", label: "Kontingensi", disabled: true, disabledReason: "Butuh approval" },
];

function Demo(): React.JSX.Element {
  const [value, setValue] = useState("material");
  return (
    <div className="w-80">
      <AdaptiveSelect
        label="Kategori Biaya"
        value={value}
        options={categoryOptions}
        onChange={setValue}
      />
    </div>
  );
}

const simpleOptions: readonly SelectOption[] = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Arsip" },
  { value: "all", label: "Semua" },
  { value: "waiting", label: "Menunggu" },
  { value: "complete", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];
const searchableOptions: readonly SelectOption[] = Array.from({ length: 10 }, (_, index) => ({
  value: index === 0 ? "one" : String(index + 1),
  label: `Pilihan ${index + 1}`,
}));

function SimpleMenuDemo(): React.JSX.Element {
  const [value, setValue] = useState("active");
  return (
    <div className="w-72">
      <AdaptiveSelect label="Status" value={value} options={simpleOptions} onChange={setValue} />
    </div>
  );
}

function SearchableDialogDemo(): React.JSX.Element {
  const [value, setValue] = useState("one");
  return (
    <div className="w-72">
      <AdaptiveSelect
        label="Proyek"
        value={value}
        options={searchableOptions}
        onChange={setValue}
      />
    </div>
  );
}

function NestedSearchDialogDemo(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("one");
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka form searchable</Button>
      <FormSheet
        open={open}
        title="Form proyek"
        dismissal={{ mode: "discard" }}
        onClose={() => setOpen(false)}
      >
        <AdaptiveSelect
          label="Proyek"
          value={value}
          options={searchableOptions}
          onChange={setValue}
        />
      </FormSheet>
    </>
  );
}

function NestedSheetDemo(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("active");
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka form</Button>
      <FormSheet
        open={open}
        title="Filter data"
        dismissal={{ mode: "discard" }}
        onClose={() => setOpen(false)}
      >
        <AdaptiveSelect label="Status" value={value} options={simpleOptions} onChange={setValue} />
      </FormSheet>
    </>
  );
}

const meta = {
  title: "ui/form/AdaptiveSelect",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
};

export const SimpleMenu: Story = {
  render: () => <SimpleMenuDemo />,
};

export const NestedInSheet: Story = {
  render: () => <NestedSheetDemo />,
};

export const SearchableDialog: Story = {
  render: () => <SearchableDialogDemo />,
};

export const NestedSearchDialog: Story = {
  render: () => <NestedSearchDialogDemo />,
};
