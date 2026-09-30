import { describe, expect, test } from "bun:test";
import { createNotificationActivity, NOTIFICATION_IDLE_MS } from "./hooks/notification-activity";

function clock(): {
  schedule: (callback: () => void, delay: number) => number;
  cancel: (handle: number) => void;
  advance: (delay: number) => void;
  pending: () => number;
} {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  return {
    schedule: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { due: now + delay, callback });
      return id;
    },
    cancel: (handle) => {
      timers.delete(handle);
    },
    advance: (delay) => {
      now += delay;
      for (const [id, timer] of timers) {
        if (timer.due > now) continue;
        timers.delete(id);
        timer.callback();
      }
    },
    pending: () => timers.size,
  };
}

describe("notification user activity", () => {
  test("stops at five minutes idle and resumes only once on interaction", () => {
    const time = clock();
    let idle = 0;
    let resumed = 0;
    const activity = createNotificationActivity(
      time,
      () => {
        idle += 1;
      },
      () => {
        resumed += 1;
      },
    );
    activity.start();
    time.advance(NOTIFICATION_IDLE_MS - 1);
    expect(idle).toBe(0);
    time.advance(1);
    expect(idle).toBe(1);
    expect(activity.touch()).toBe(true);
    expect(activity.touch()).toBe(false);
    expect(resumed).toBe(1);
    activity.stop();
    expect(time.pending()).toBe(0);
  });

  test("normal interaction extends the idle window without triggering refresh", () => {
    const time = clock();
    let idle = 0;
    let resumed = 0;
    const activity = createNotificationActivity(
      time,
      () => {
        idle += 1;
      },
      () => {
        resumed += 1;
      },
    );
    activity.start();
    time.advance(4 * 60_000);
    activity.touch();
    time.advance(4 * 60_000);
    expect(idle).toBe(0);
    expect(resumed).toBe(0);
    time.advance(60_000);
    expect(idle).toBe(1);
    activity.stop();
    time.advance(NOTIFICATION_IDLE_MS);
    expect(activity.touch()).toBe(false);
    expect(resumed).toBe(0);
  });
});
