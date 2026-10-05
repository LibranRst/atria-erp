import { describe, expect, test } from "bun:test";
import { createDeferredChoiceCommit } from "./deferred-choice-commit";

describe("anchored choice commits after native dismissal", () => {
  test("selection keeps parent form rows unchanged until native exit completes", () => {
    const choice = createDeferredChoiceCommit();
    let clientKind = "existing";
    const rows = (): readonly string[] =>
      clientKind === "existing"
        ? ["name", "clientKind", "client", "projectManager"]
        : ["name", "clientKind", "newClientName", "email", "phone", "address", "projectManager"];
    const token = choice.begin();
    choice.select(token, "new", (value: string): void => {
      clientKind = value;
    });
    expect(rows()).toEqual(["name", "clientKind", "client", "projectManager"]);
    expect(choice.complete(token)).toBe(true);
    expect(rows()).toEqual([
      "name",
      "clientKind",
      "newClientName",
      "email",
      "phone",
      "address",
      "projectManager",
    ]);
  });

  test("outside cancellation does not commit or accept a late selection", () => {
    const choice = createDeferredChoiceCommit();
    const commits: string[] = [];
    const token = choice.begin();
    expect(choice.complete(token)).toBe(false);
    choice.select(token, "new", (value: string): void => {
      commits.push(value);
    });
    expect(choice.complete(token)).toBe(false);
    expect(commits).toEqual([]);
  });

  test("empty values commit once despite duplicate dismissal and selection events", () => {
    const choice = createDeferredChoiceCommit();
    const commits: string[] = [];
    const commit = (value: string): void => {
      commits.push(value);
    };
    const token = choice.begin();
    choice.select(token, "", commit);
    expect(commits).toEqual([]);
    expect(choice.complete(token)).toBe(true);
    expect(choice.complete(token)).toBe(false);
    choice.select(token, "new", commit);
    expect(choice.complete(token)).toBe(false);
    expect(commits).toEqual([""]);
  });

  test("unmount invalidates pending selection and later native events", () => {
    const choice = createDeferredChoiceCommit();
    const commits: string[] = [];
    const commit = (value: string): void => {
      commits.push(value);
    };
    const token = choice.begin();
    choice.select(token, "new", commit);
    choice.dispose();
    expect(choice.complete(token)).toBe(false);
    const laterToken = choice.begin();
    choice.select(laterToken, "existing", commit);
    expect(choice.complete(laterToken)).toBe(false);
    expect(commits).toEqual([]);
  });

  test("fast reopen discards the old choice and stale exit cannot commit the new one", () => {
    const choice = createDeferredChoiceCommit();
    const commits: string[] = [];
    const commit = (value: string): void => {
      commits.push(value);
    };
    const first = choice.begin();
    choice.select(first, "new", commit);
    const second = choice.begin();
    expect(second).toBeGreaterThan(first);
    choice.select(second, "existing", commit);
    expect(choice.complete(first)).toBe(false);
    expect(commits).toEqual([]);
    choice.select(first, "stale", commit);
    expect(choice.complete(second)).toBe(true);
    expect(commits).toEqual(["existing"]);
  });

  test("consumes the choice before a reentrant completion callback", () => {
    const choice = createDeferredChoiceCommit();
    const token = choice.begin();
    let commits = 0;
    choice.select(token, "new", (): void => {
      commits += 1;
      expect(choice.complete(token)).toBe(false);
    });
    expect(choice.complete(token)).toBe(true);
    expect(commits).toBe(1);
  });
});
