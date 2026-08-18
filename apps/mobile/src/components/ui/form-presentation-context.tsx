import { createContext, use } from "react";

export type FormPresentation = "standalone" | "grouped";

const FormPresentationContext = createContext<FormPresentation>("standalone");

export function FormPresentationProvider({
  children,
  presentation,
}: {
  readonly children: React.ReactNode;
  readonly presentation: FormPresentation;
}): React.JSX.Element {
  return (
    <FormPresentationContext.Provider value={presentation}>
      {children}
    </FormPresentationContext.Provider>
  );
}

export function useFormPresentation(): FormPresentation {
  return use(FormPresentationContext);
}
