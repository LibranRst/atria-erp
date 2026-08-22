"use client";

import React from "react";

import { BottomSheet, type BottomSheetProps } from "./bottom-sheet";

export type FormSheetProps = BottomSheetProps;
export type DetailSheetProps = BottomSheetProps;

/** Form dengan tiga field atau lebih, atau review keputusan yang membutuhkan ruang. */
export function FormSheet(props: FormSheetProps): React.JSX.Element | null {
  return <BottomSheet {...props} />;
}

/** Detail kontekstual/read-only yang membutuhkan scroll atau informasi lanjutan. */
export function DetailSheet(props: DetailSheetProps): React.JSX.Element | null {
  return <BottomSheet {...props} />;
}
