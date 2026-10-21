import React from "react";
import { MetadataChip } from "@/components/ui";
import { projectStockCounts } from "./project-stock-desktop-model";
import type { ProjectStockItem } from "./project-stock-types";

/** The mobile identity surface counts records instead of adding quantities with different units. */
export function ProjectStockMobileSummary({
  items,
}: {
  readonly items: readonly ProjectStockItem[];
}): React.JSX.Element {
  const counts = projectStockCounts(items);
  return (
    <>
      <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
        Posisi material proyek
      </p>
      <div className="mt-2 flex flex-col justify-between">
        <div className="flex flex-row items-end justify-between">
          <div className="font-mono text-4xl leading-none font-bold tabular-nums">
            {counts.materials.toLocaleString("id-ID")}
          </div>
          <MetadataChip className="h-fit bg-white/10 text-meta font-bold text-white/80">
            baris material RAP
          </MetadataChip>
        </div>
        <p className="text-meta text-white/60">
          Jumlah baris material; kuantitas mengikuti satuannya di rincian.
        </p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <RecordFact label="Direservasi" value={counts.reserved} />
        <RecordFact label="Terpakai" value={counts.used} />
        <RecordFact label="Sisa proyek" value={counts.leftover} />
      </div>
    </>
  );
}

function RecordFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/7.5 p-3 pr-2">
      <p className="truncate text-[8px] leading-none font-bold tracking-wide text-white/50 uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-[18px] leading-none font-bold tabular-nums">
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
