import { createContext, useContext } from "react";
import type { ButtonSize } from "./button.types";

/** Sheet owners supply a default; explicit compact actions keep their size. */
export const ButtonSizeContext = createContext<ButtonSize>("regular");

export function useButtonSize(size?: ButtonSize): ButtonSize {
  const inherited = useContext(ButtonSizeContext);
  return size ?? inherited;
}
