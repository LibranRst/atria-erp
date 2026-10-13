import { describe, expect, test } from "bun:test";
import {
  createUnsavedChangesStore,
  leaveDecision,
  leaveDestination,
} from "./unsaved-changes-policy";

describe("admin unsaved navigation", () => {
  test("a dirty editor asks before links or logout, and a pending operation cannot be discarded", () => {
    const store = createUnsavedChangesStore();
    expect(leaveDecision(store.getSnapshot())).toBe("allow");
    store.register("budget", { dirty: true, pending: false, label: "budget proyek" });
    expect(leaveDecision(store.getSnapshot())).toBe("confirm");
    store.register("budget", { dirty: true, pending: true, label: "budget proyek" });
    expect(leaveDecision(store.getSnapshot())).toBe("pending");
    store.register("budget", { dirty: false, pending: true, label: "budget proyek" });
    expect(leaveDecision(store.getSnapshot())).toBe("pending");
    store.register("budget", { dirty: false, pending: false, label: "budget proyek" });
    expect(leaveDecision(store.getSnapshot())).toBe("allow");
  });
  test("multiple drafts preserve the remaining guard and subscriptions stop on cleanup", () => {
    const store = createUnsavedChangesStore();
    let updates = 0;
    const unsubscribe = store.subscribe(() => {
      updates += 1;
    });
    store.register("budget", { dirty: true, pending: false, label: "budget" });
    const stable = store.getSnapshot();
    store.register("budget", { dirty: true, pending: false, label: "budget" });
    expect(store.getSnapshot()).toBe(stable);
    expect(updates).toBe(1);
    store.register("project", { dirty: true, pending: false, label: "proyek" });
    store.remove("budget");
    expect(leaveDecision(store.getSnapshot())).toBe("confirm");
    expect(store.getSnapshot().label).toBe("proyek");
    unsubscribe();
    const count = updates;
    store.remove("project");
    expect(leaveDecision(store.getSnapshot())).toBe("allow");
    expect(updates).toBe(count);
  });
  test("internal and external destinations retain query/hash and in-page anchors keep drafts", () => {
    const current = "https://admin.example.test/projects/123/budget?tab=allocation";
    expect(leaveDestination("/projects/123?tab=budget#totals", current)).toEqual({
      href: "/projects/123?tab=budget#totals",
      external: false,
      leavesPage: true,
    });
    expect(
      leaveDestination("https://atria.example.test/projects/123?surface=mobile#totals", current),
    ).toEqual({
      href: "https://atria.example.test/projects/123?surface=mobile#totals",
      external: true,
      leavesPage: true,
    });
    const anchor = leaveDestination("#main-content", current);
    expect(anchor?.leavesPage).toBe(false);
    expect(leaveDecision({ dirty: true, pending: true, label: "budget" }, anchor?.leavesPage)).toBe(
      "allow",
    );
    expect(leaveDestination("mailto:finance@example.test", current)).toBeNull();
  });
});
