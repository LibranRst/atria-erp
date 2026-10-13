"use client";

import React, { type ReactNode } from "react";

import { Button, type ButtonVariant } from "../button/button";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

export type SheetFooterAction = {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly form?: string;
  readonly type?: "button" | "submit";
  readonly onClick?: () => void;
  readonly variant?: ButtonVariant;
};

export type SheetFooterActionsProps = {
  readonly primary: SheetFooterAction & {
    readonly variant?: Extract<ButtonVariant, "primary" | "critical">;
  };
  readonly secondary?: SheetFooterAction;
  readonly status?: ReactNode;
  readonly disabledReason?: string;
  /** Review-canvas footer: stack on desktop and keep secondary actions distinct from gray. */
  readonly desktopStacked?: boolean;
  /** Share a row when both labels fit; otherwise each action fills its own row. */
  readonly layout?: "columns" | "adaptive";
  readonly primaryFirst?: boolean;
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
  desktopStacked = false,
  layout = "columns",
  primaryFirst = false,
}: SheetFooterActionsProps): React.JSX.Element {
  const reasonId = React.useId();
  const presentation = useWorkspacePresentation();
  const stacked = desktopStacked && presentation === "desktop";
  const adaptive = layout === "adaptive" && !stacked;
  const actionClassName = adaptive ? "min-w-max flex-auto" : "min-w-0";
  // Review footers sit on the gray sheet canvas at either width; quiet actions
  // retain their gray treatment only inside white card/confirmation owners.
  const secondaryVariant =
    desktopStacked && secondary?.variant === "quiet"
      ? "secondary"
      : (secondary?.variant ?? "secondary");
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
  const primaryControl = (
    <Button
      data-atria-footer-action="primary"
      type={primary.type ?? "button"}
      form={primary.form}
      onClick={primary.onClick}
      disabled={primary.disabled}
      pending={primary.pending}
      pendingLabel={primary.pendingLabel}
      variant={primary.variant ?? "primary"}
      fullWidth={!adaptive || !secondary}
      className={actionClassName}
      {...primaryGuards}
    >
      {primary.label}
    </Button>
  );

  return (
    <div className="space-y-2">
      {status ? <div className="px-1">{status}</div> : null}
      <div aria-live="polite" className="empty:hidden">
        {disabledReason ? (
          <p id={reasonId} className="px-1 text-meta font-medium text-on-surface-variant">
            {disabledReason}
          </p>
        ) : null}
      </div>
      {secondary ? (
        <div
          className={
            stacked
              ? "grid grid-cols-1 gap-2"
              : adaptive
                ? "flex flex-wrap gap-2"
                : "grid grid-cols-2 gap-2"
          }
        >
          {primaryFirst ? primaryControl : null}
          <Button
            type={secondary.type ?? "button"}
            form={secondary.form}
            onClick={secondary.onClick}
            disabled={secondary.disabled}
            pending={secondary.pending}
            pendingLabel={secondary.pendingLabel}
            variant={secondaryVariant}
            fullWidth={!adaptive}
            className={actionClassName}
          >
            {secondary.label}
          </Button>
          {primaryFirst ? null : primaryControl}
        </div>
      ) : (
        primaryControl
      )}
    </div>
  );
}
