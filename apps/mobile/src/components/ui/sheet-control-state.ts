export type SheetControl = {
  readonly validate: () => string | null;
  readonly hasUncommittedEdits: () => boolean;
};

export type SheetControlState = {
  readonly registerControl: (id: string, control: SheetControl) => () => void;
  readonly validateControls: () => Readonly<Record<string, string>>;
  readonly hasUncommittedEdits: () => boolean;
  readonly subscribeControlState: (listener: () => void) => () => void;
  readonly notifyControlState: () => void;
};

/** Control drafts can differ from persisted form values without losing dirty/validation guards. */
export function createSheetControlState(): SheetControlState {
  const controls = new Map<string, SheetControl>();
  const listeners = new Set<() => void>();
  function notifyControlState(): void {
    for (const listener of listeners) listener();
  }
  return {
    registerControl(id: string, control: SheetControl): () => void {
      controls.set(id, control);
      notifyControlState();
      return (): void => {
        if (controls.get(id) !== control) return;
        controls.delete(id);
        notifyControlState();
      };
    },
    validateControls(): Readonly<Record<string, string>> {
      const errors: Record<string, string> = {};
      for (const [id, control] of controls) {
        const error = control.validate();
        if (error) errors[id] = error;
      }
      return errors;
    },
    hasUncommittedEdits(): boolean {
      return [...controls.values()].some((control) => control.hasUncommittedEdits());
    },
    subscribeControlState(listener: () => void): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    notifyControlState,
  };
}
