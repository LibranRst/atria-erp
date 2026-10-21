export type NativePopoverProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onDismiss?: () => void;
  readonly children: React.ReactElement;
  readonly content: React.ReactElement;
  readonly contentWidth?: number;
};
