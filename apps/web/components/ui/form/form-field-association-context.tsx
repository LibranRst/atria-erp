"use client";

import React from "react";

export type FormFieldAssociation = {
  readonly controlId: string;
  readonly describedBy?: string;
  readonly invalid: boolean;
  readonly required: boolean;
};

const FormFieldAssociationContext = React.createContext<FormFieldAssociation | null>(null);

export const FormFieldAssociationProvider = FormFieldAssociationContext.Provider;

export function useFormFieldAssociation(): FormFieldAssociation | null {
  return React.useContext(FormFieldAssociationContext);
}

export function mergeAriaIds(...values: readonly (string | undefined)[]): string | undefined {
  const ids = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .map((value) => value.trim())
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

  return ids.length > 0 ? ids.join(" ") : undefined;
}
