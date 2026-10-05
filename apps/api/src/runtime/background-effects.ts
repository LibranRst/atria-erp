import type { AfterEffect } from "./request-context";

export class BackgroundEffects {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly onError: (error: unknown) => void) {}

  schedule(effects: readonly AfterEffect[]): void {
    for (const effect of effects) {
      const task = Promise.resolve()
        .then(effect)
        .then((): void => undefined)
        .catch((error: unknown): void => {
          try {
            this.onError(error);
          } catch {
            /* Reporting must not create an unhandled rejection. */
          }
        })
        .finally((): void => {
          this.pending.delete(task);
        });
      this.pending.add(task);
    }
  }

  async drain(timeoutMs: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve): void => {
      timer = setTimeout((): void => resolve(false), timeoutMs);
    });
    try {
      return await Promise.race([Promise.all([...this.pending]).then((): true => true), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
