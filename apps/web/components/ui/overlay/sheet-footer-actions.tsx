"use client";

import React, { type ReactNode } from "react";

import { Button, type ButtonVariant } from "../button/button";

type SheetFooterAction = {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly form?: string;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
};

type SheetFooterActionsProps = {
  readonly primary: SheetFooterAction & {
    readonly variant?: Extract<ButtonVariant, "primary" | "critical">;
  };
  readonly secondary?: SheetFooterAction;
  readonly status?: ReactNode;
  readonly disabledReason?: string;
};

/**
 * Aksi utama sebuah sheet, berikut alasannya bila sedang terblokir.
 *
 * Alasan yang tertulis tetapi tidak tertaut hanya berguna bagi yang melihatnya.
 * Tombol ber-`disabled` keluar dari urutan fokus, jadi pengguna keyboard
 * menyusuri sheet sampai ujung dan mendapati tombol kirimnya seolah tidak ada.
 * Karena itu, begitu ada alasan, tombolnya dinonaktifkan secara lunak: tetap
 * dapat difokus dan diumumkan lewat `aria-disabled`, alasannya tertaut lewat
 * `aria-describedby`, dan perubahan alasannya diumumkan oleh live region.
 * Aktivasinya dijaga di sini supaya tidak ada pemanggil yang perlu mengingatnya.
 */
export function SheetFooterActions({
  primary,
  secondary,
  status,
  disabledReason,
}: SheetFooterActionsProps): React.JSX.Element {
  const reasonId = React.useId();
  // Hanya blokir lunak ketika alasannya benar-benar ada untuk dibacakan.
  const blocked = Boolean(primary.disabled) && Boolean(disabledReason);

  const primaryGuards = blocked
    ? {
        "aria-disabled": true as const,
        "aria-describedby": reasonId,
        // `submit` tetap mengirim form walau tombolnya beratribut aria; paksa
        // menjadi tombol biasa selama terblokir.
        type: "button" as const,
        form: undefined,
        onClick: undefined,
        disabled: undefined,
      }
    : {};

  return (
    <div className="space-y-2">
      {status ? <div className="px-1">{status}</div> : null}
      <div aria-live="polite">
        {disabledReason ? (
          <p id={reasonId} className="px-1 text-meta font-medium text-on-surface-variant">
            {disabledReason}
          </p>
        ) : null}
      </div>
      {secondary ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type={secondary.type ?? "button"}
            form={secondary.form}
            onClick={secondary.onClick}
            disabled={secondary.disabled}
            pending={secondary.pending}
            pendingLabel={secondary.pendingLabel}
            variant="secondary"
            fullWidth
            className="min-w-0"
          >
            {secondary.label}
          </Button>
          <Button
            type={primary.type ?? "button"}
            form={primary.form}
            onClick={primary.onClick}
            disabled={primary.disabled}
            pending={primary.pending}
            pendingLabel={primary.pendingLabel}
            variant={primary.variant ?? "primary"}
            fullWidth
            className="min-w-0"
            {...primaryGuards}
          >
            {primary.label}
          </Button>
        </div>
      ) : (
        <Button
          type={primary.type ?? "button"}
          form={primary.form}
          onClick={primary.onClick}
          disabled={primary.disabled}
          pending={primary.pending}
          pendingLabel={primary.pendingLabel}
          variant={primary.variant ?? "primary"}
          fullWidth
          {...primaryGuards}
        >
          {primary.label}
        </Button>
      )}
    </div>
  );
}
