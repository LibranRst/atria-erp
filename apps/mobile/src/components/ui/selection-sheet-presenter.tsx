import { DialogFrame } from "./dialog-frame";
import type { SelectionSheetPresenterProps } from "./selection-sheet-presenter.types";

/** Deprecated presenter; retained callers receive the shared compact dialog. */
export function SelectionSheetPresenter({
  children,
  onClose,
  visible,
}: SelectionSheetPresenterProps): React.JSX.Element {
  return (
    <DialogFrame title="Pilihan" visible={visible} onClose={onClose}>
      {children}
    </DialogFrame>
  );
}
