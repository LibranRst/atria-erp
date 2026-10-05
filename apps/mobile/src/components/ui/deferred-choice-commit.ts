export type DeferredChoiceCommit = {
  readonly begin: () => number;
  readonly select: (token: number, value: string, commit: (value: string) => void) => void;
  readonly complete: (token: number) => boolean;
  readonly dispose: () => void;
};

export function createDeferredChoiceCommit(): DeferredChoiceCommit {
  let version = 0;
  let disposed = false;
  let completed = true;
  let pending: { readonly value: string; readonly commit: (value: string) => void } | undefined;

  return {
    begin(): number {
      version += 1;
      pending = undefined;
      completed = false;
      return version;
    },
    select(token: number, value: string, commit: (value: string) => void): void {
      if (disposed || completed || token !== version) return;
      pending = { value, commit };
    },
    complete(token: number): boolean {
      if (disposed || completed || token !== version) return false;
      const selection = pending;
      pending = undefined;
      completed = true;
      if (!selection) return false;
      selection.commit(selection.value);
      return true;
    },
    dispose(): void {
      disposed = true;
      completed = true;
      pending = undefined;
      version += 1;
    },
  };
}
