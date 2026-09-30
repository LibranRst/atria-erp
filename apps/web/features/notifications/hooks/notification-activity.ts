export const NOTIFICATION_IDLE_MS = 5 * 60_000;

export type ActivityTimers<THandle> = {
  schedule: (callback: () => void, delay: number) => THandle;
  cancel: (handle: THandle) => void;
};

export function createNotificationActivity<THandle>(
  timers: ActivityTimers<THandle>,
  onIdle: () => void,
  onResume: () => void,
): {
  start: () => void;
  touch: () => boolean;
  stop: () => void;
} {
  let running = false;
  let idle = false;
  let timer: THandle | undefined;
  const clear = (): void => {
    if (timer !== undefined) timers.cancel(timer);
    timer = undefined;
  };
  const arm = (): void => {
    clear();
    timer = timers.schedule(() => {
      timer = undefined;
      if (!running || idle) return;
      idle = true;
      onIdle();
    }, NOTIFICATION_IDLE_MS);
  };
  return {
    start: (): void => {
      running = true;
      idle = false;
      arm();
    },
    touch: (): boolean => {
      if (!running) return false;
      const resumed = idle;
      idle = false;
      arm();
      if (resumed) onResume();
      return resumed;
    },
    stop: (): void => {
      running = false;
      clear();
    },
  };
}
