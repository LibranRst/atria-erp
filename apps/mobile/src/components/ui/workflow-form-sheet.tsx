import { BottomSheet, type BottomSheetProps } from "./bottom-sheet";

/** Editable workflows use the shared geometry; controls mount after presentation. */
export function WorkflowFormSheet(
  props: BottomSheetProps & {
    readonly title: string;
    readonly footer: React.ReactNode;
  },
): React.JSX.Element {
  return <BottomSheet {...props} deferContent sizing={props.sizing ?? "maximum"} />;
}
