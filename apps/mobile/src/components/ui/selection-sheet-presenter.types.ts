import type { ReactElement } from "react";

export type SelectionSheetPresenterProps = {
  readonly children: ReactElement;
  readonly onClose: () => void;
  readonly visible: boolean;
};
