import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";

type SelectTab = (name: string, params?: Readonly<Record<string, string>>) => boolean;
type MainNavigation = {
  readonly register: (select: SelectTab) => () => void;
  readonly select: SelectTab;
};
const Context = createContext<MainNavigation | null>(null);
export function MainNavigationProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const handler = useRef<SelectTab | null>(null);
  const register = useCallback((select: SelectTab): (() => void) => {
    handler.current = select;
    return () => {
      if (handler.current === select) handler.current = null;
    };
  }, []);
  const select = useCallback<SelectTab>(
    (name, params) => handler.current?.(name, params) ?? false,
    [],
  );
  const value = useMemo(() => ({ register, select }), [register, select]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMainNavigation(): MainNavigation {
  const value = useContext(Context);
  if (!value) throw new Error("Navigasi utama belum disiapkan.");
  return value;
}
