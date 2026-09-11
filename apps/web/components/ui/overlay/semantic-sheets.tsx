"use client";

import React from "react";

import { BottomSheet, type BottomSheetProps } from "./bottom-sheet";
import { ConfirmationDialog } from "./dialogs";

export type FormSheetDismissal = (
  | {
      readonly mode: "discard";
      readonly onDiscard?: () => void;
    }
  | {
      readonly mode: "confirm";
      readonly dirty: boolean;
      readonly onDiscard: () => void;
      readonly title?: string;
      readonly description?: string;
    }
  | {
      readonly mode: "preserve";
    }
  | {
      readonly mode: "managed";
    }
) & {
  readonly blocked?: boolean;
};

export type FormSheetProps = BottomSheetProps & {
  readonly dismissal: FormSheetDismissal;
  readonly pending?: boolean;
};
export type DetailSheetProps = BottomSheetProps;

/** Form dengan tiga field atau lebih, atau review keputusan yang membutuhkan ruang. */
export function FormSheet({
  dismissal,
  pending = false,
  onClose,
  ...props
}: FormSheetProps): React.JSX.Element | null {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const closeBlocked = pending || Boolean(dismissal.blocked);

  function requestClose(): void {
    if (closeBlocked) return;
    if (dismissal.mode === "confirm" && dismissal.dirty) {
      setConfirmDiscard(true);
      return;
    }
    if (dismissal.mode === "discard") dismissal.onDiscard?.();
    onClose();
  }

  function discardAndClose(): void {
    if (dismissal.mode !== "confirm" || closeBlocked) return;
    dismissal.onDiscard();
    setConfirmDiscard(false);
    onClose();
  }

  return (
    <>
      <BottomSheet {...props} onClose={requestClose} />
      <ConfirmationDialog
        open={props.open && confirmDiscard}
        title={
          dismissal.mode === "confirm"
            ? (dismissal.title ?? "Buang perubahan?")
            : "Buang perubahan?"
        }
        description={
          dismissal.mode === "confirm"
            ? (dismissal.description ?? "Perubahan yang belum disimpan akan hilang.")
            : "Perubahan yang belum disimpan akan hilang."
        }
        confirmLabel="Buang perubahan"
        danger
        pending={closeBlocked}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={discardAndClose}
      />
    </>
  );
}

/** Detail kontekstual/read-only yang membutuhkan scroll atau informasi lanjutan. */
export function DetailSheet(props: DetailSheetProps): React.JSX.Element | null {
  return <BottomSheet {...props} />;
}
