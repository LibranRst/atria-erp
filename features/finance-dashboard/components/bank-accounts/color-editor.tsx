import React from "react";
import { Repeat2, RotateCcw } from "lucide-react";

import { FormField } from "@/components/ui";
import { useFormPresentation } from "@/components/ui/form-presentation-context";
import { CARD_PRESETS } from "./constants";
import type { AccountDraft } from "./types";

function ColorInput({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  return (
    <FormField label={label}>
      <label
        className={
          grouped
            ? "flex min-h-9 items-center gap-3 bg-transparent"
            : "flex min-h-12 items-center gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15"
        }
      >
        <span
          className="h-6 w-6 rounded-full border border-white/70 shadow-sm"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 font-mono text-xs font-bold text-on-surface">
          {value.toUpperCase()}
        </span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          aria-label={label}
        />
      </label>
    </FormField>
  );
}

export function ColorEditor({
  draft,
  setDraft,
}: {
  readonly draft: AccountDraft;
  readonly setDraft: React.Dispatch<React.SetStateAction<AccountDraft>>;
}): React.JSX.Element {
  function patch(next: Partial<AccountDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <section className="space-y-3">
      <div
        className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[28px] p-5 shadow-[0_14px_34px_rgba(17,17,17,0.08)] ${
          draft.cardTextColor === "dark" ? "text-[#141414]" : "text-white"
        }`}
        style={{
          backgroundImage: `linear-gradient(135deg, ${draft.cardColorFrom}, ${draft.cardColorTo})`,
        }}
      >
        <span
          className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-white/12 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-[1.15] font-semibold">
              {draft.name || "Nama rekening"}
            </h3>
            <p className="mt-1 truncate text-[10px] font-medium tracking-[0.08em] uppercase opacity-65">
              {draft.bankName || "Nama bank"}
            </p>
          </div>
          <span className="material-symbols-outlined text-[23px] opacity-65" aria-hidden="true">
            contactless
          </span>
        </div>
        <div className="relative mt-auto">
          <p className="text-[9px] font-semibold tracking-[0.13em] uppercase opacity-60">
            Saldo tersedia
          </p>
          <p className="mt-1.5 font-mono text-lg font-bold whitespace-nowrap tabular-nums">Rp 0</p>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] font-semibold tracking-[0.16em] opacity-75">
            •••• {(draft.accountNumber || "0000").slice(-4)}
          </p>
          <p className="max-w-[55%] min-w-0 truncate text-right text-[9px] font-semibold tracking-widest uppercase opacity-60">
            {draft.holderName || "Pemegang"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CARD_PRESETS.map((preset) => {
          const active =
            draft.cardColorFrom === preset.from &&
            draft.cardColorTo === preset.to &&
            draft.cardTextColor === preset.text;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() =>
                patch({
                  cardColorFrom: preset.from,
                  cardColorTo: preset.to,
                  cardTextColor: preset.text,
                })
              }
              className={`min-h-12 rounded-full px-2 text-[9px] font-black transition active:scale-[0.97] ${
                preset.text === "dark" ? "text-[#141414]" : "text-white"
              } ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
              style={{
                backgroundImage: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
              }}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorInput
          label="Warna awal"
          value={draft.cardColorFrom}
          onChange={(value) => patch({ cardColorFrom: value })}
        />
        <ColorInput
          label="Warna akhir"
          value={draft.cardColorTo}
          onChange={(value) => patch({ cardColorTo: value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() =>
            patch({
              cardColorFrom: draft.cardColorTo,
              cardColorTo: draft.cardColorFrom,
            })
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-[10px] font-bold text-on-surface active:scale-[0.97]"
        >
          <Repeat2 className="h-4 w-4" />
          Balik warna
        </button>
        <button
          type="button"
          onClick={() =>
            patch({
              cardColorFrom: CARD_PRESETS[0].from,
              cardColorTo: CARD_PRESETS[0].to,
              cardTextColor: CARD_PRESETS[0].text,
            })
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-[10px] font-bold text-on-surface active:scale-[0.97]"
        >
          <RotateCcw className="h-4 w-4" />
          Atur ulang
        </button>
        <button
          type="button"
          onClick={() =>
            patch({
              cardTextColor: draft.cardTextColor === "light" ? "dark" : "light",
            })
          }
          className="min-h-12 rounded-full bg-surface-container-low px-4 text-[10px] font-bold text-on-surface active:scale-[0.97]"
        >
          Teks {draft.cardTextColor === "light" ? "Terang" : "Gelap"}
        </button>
      </div>
    </section>
  );
}
