import React from "react";

import { AppIcon, FormField, useFormPresentation } from "@/components/ui";
import { CARD_PRESETS } from "@/features/finance-dashboard/utils/bank-account-constants";
import type { AccountDraft } from "@/features/finance-dashboard/types/bank-account-types";
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
            : "flex min-h-12 items-center gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring"
        }
      >
        <span
          className="h-6 w-6 rounded-full border border-white/70 shadow-control"
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
          className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
        className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[28px] p-5 shadow-raised ${
          draft.cardTextColor === "dark" ? "text-on-surface" : "text-white"
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
            <p className="mt-1 truncate text-meta font-medium tracking-[0.08em] uppercase opacity-65">
              {draft.bankName || "Nama bank"}
            </p>
          </div>
          <AppIcon name="contactless" className="text-[23px] opacity-65" />
        </div>
        <div className="relative mt-auto">
          <p className="text-eyebrow font-semibold tracking-[0.13em] uppercase opacity-60">
            Saldo tersedia
          </p>
          <p className="mt-1.5 font-mono text-lg font-bold whitespace-nowrap tabular-nums">Rp 0</p>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <p className="font-mono text-support font-semibold tracking-[0.16em] opacity-75">
            •••• {(draft.accountNumber || "0000").slice(-4)}
          </p>
          <p className="max-w-[55%] min-w-0 truncate text-right text-eyebrow font-semibold tracking-widest uppercase opacity-60">
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
              className={`min-h-12 rounded-full px-2 text-eyebrow font-black transition active:scale-[0.97] ${
                preset.text === "dark" ? "text-on-surface" : "text-white"
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
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-meta font-bold text-on-surface active:scale-[0.97]"
        >
          <AppIcon name="swap_horiz" className="icon-sm" />
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
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-meta font-bold text-on-surface active:scale-[0.97]"
        >
          <AppIcon name="restore" className="icon-sm" />
          Atur ulang
        </button>
        <button
          type="button"
          onClick={() =>
            patch({
              cardTextColor: draft.cardTextColor === "light" ? "dark" : "light",
            })
          }
          className="min-h-12 rounded-full bg-surface-container-low px-4 text-meta font-bold text-on-surface active:scale-[0.97]"
        >
          Teks {draft.cardTextColor === "light" ? "Terang" : "Gelap"}
        </button>
      </div>
    </section>
  );
}
