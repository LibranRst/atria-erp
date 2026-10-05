import { expect, test } from "bun:test";
import { updateUrlSearchParam } from "./use-url-search-param";

test("removing a push read marker preserves the destination query and hash", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const replaced: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        pathname: "/projects/abc",
        search: "?tab=overview&notificationId=11111111-1111-4111-8111-111111111111",
        hash: "#budget",
      },
      history: {
        replaceState: (_data: unknown, _unused: string, url: string): void => {
          replaced.push(url);
        },
      },
    },
  });
  try {
    expect(updateUrlSearchParam("notificationId", null, "replace")).toBe(
      "/projects/abc?tab=overview#budget",
    );
    expect(replaced).toEqual(["/projects/abc?tab=overview#budget"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
