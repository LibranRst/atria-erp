"use client";

import React from "react";

export type FormPresentation = "standalone" | "grouped";
export type FormFieldLayout = "stacked" | "inline";

const FormPresentationContext = React.createContext<FormPresentation>("standalone");

export function FormPresentationProvider({
  presentation,
  children,
}: {
  readonly presentation: FormPresentation;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <FormPresentationContext.Provider value={presentation}>
      {children}
    </FormPresentationContext.Provider>
  );
}

export function useFormPresentation(): FormPresentation {
  return React.useContext(FormPresentationContext);
}
