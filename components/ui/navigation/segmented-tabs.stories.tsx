import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { SegmentedTabs, type SegmentedTabOption } from "./segmented-tabs";

type DemoValue = "active" | "pending" | "closed";

const baseOptions: readonly SegmentedTabOption<DemoValue>[] = [
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Menunggu", count: 3 },
  { value: "closed", label: "Selesai" },
];

function ControlledTabs(props: {
  readonly options: readonly SegmentedTabOption<DemoValue>[];
  readonly scrollable?: boolean;
  readonly fillAvailableSpace?: boolean;
  readonly density?: "default" | "compact";
}): React.JSX.Element {
  const [value, setValue] = useState<DemoValue>("active");
  return (
    <div className="w-80">
      <SegmentedTabs
        value={value}
        options={props.options}
        onChange={setValue}
        ariaLabel="Status proyek"
        scrollable={props.scrollable}
        fillAvailableSpace={props.fillAvailableSpace}
        density={props.density}
      />
    </div>
  );
}

const meta = {
  title: "ui/navigation/SegmentedTabs",
  component: ControlledTabs,
  args: { options: baseOptions },
} satisfies Meta<typeof ControlledTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { density: "compact" },
};

export const Scrollable: Story = {
  args: {
    scrollable: true,
    options: [
      { value: "active", label: "Semua Proyek" },
      { value: "pending", label: "Menunggu Persetujuan", count: 5 },
      { value: "closed", label: "Selesai & Diarsipkan" },
    ],
  },
};

export const WithUnavailableOption: Story = {
  args: {
    options: [
      { value: "active", label: "Aktif" },
      {
        value: "pending",
        label: "Terkunci",
        unavailable: true,
        unavailableReason: "Butuh RAB disetujui",
      },
      { value: "closed", label: "Selesai" },
    ],
  },
};
