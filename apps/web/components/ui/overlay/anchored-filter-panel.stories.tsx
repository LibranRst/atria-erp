import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { IconButton } from "../button/button";
import { FilterSelect } from "../form/select-form-controls";
import { AppIcon } from "../icon/app-icon";
import { AnchoredFilterPanel } from "./anchored-filter-panel";

const options = [
  { value: "ALL", label: "Semua" },
  { value: "MATERIAL", label: "Material" },
  { value: "TUKANG", label: "Tukang" },
] as const;

function FilterPanelDemo(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("ALL");
  const [draft, setDraft] = useState("ALL");

  function copyActiveToDraft(): void {
    setDraft(active);
  }

  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 bg-background p-6">
      <AnchoredFilterPanel
        open={open}
        title="Filter material"
        trigger={
          <IconButton
            label="Buka filter material"
            icon={<AppIcon name="tune" className="icon-md" />}
          />
        }
        onOpenChange={(nextOpen) => {
          if (nextOpen) copyActiveToDraft();
          setOpen(nextOpen);
        }}
        onDismiss={copyActiveToDraft}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraft("ALL")}
              className="min-h-12 rounded-full bg-surface-container px-4 text-support font-bold"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setActive(draft);
                setOpen(false);
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-support font-bold text-on-primary"
            >
              Terapkan
            </button>
          </div>
        }
      >
        <FilterSelect
          label="Kategori"
          value={draft}
          options={options}
          onChange={setDraft}
          presentation="dialog"
        />
      </AnchoredFilterPanel>
      <p data-testid="active-filter" className="text-support text-on-surface-variant">
        Aktif: {active}
      </p>
    </div>
  );
}

const meta = {
  title: "ui/overlay/AnchoredFilterPanel",
  component: FilterPanelDemo,
} satisfies Meta<typeof FilterPanelDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
