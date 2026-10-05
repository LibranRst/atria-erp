import { describe, expect, test } from "bun:test";
import { cache } from "./react-cache";
import { after } from "./next-server";
import { revalidatePath } from "./cache";
import { cookies, headers, withRequestContext } from "./request-context";
import { RedirectControl, redirect, NotFoundControl, notFound } from "./navigation";

describe("portable API request context", (): void => {
  test("isolates concurrent cookies, headers, memoized permissions and invalidations", async (): Promise<void> => {
    let reads = 0;
    const permission = cache(async (role: string): Promise<string> => {
      reads += 1;
      return `${role}:${(await headers()).get("authorization")}`;
    });
    const execute = (identity: string) =>
      withRequestContext(
        new Request("http://localhost/api", {
          headers: { Cookie: `session=${identity}=signed`, Authorization: `Bearer ${identity}` },
        }),
        async () => {
          const first = await permission("role");
          await Promise.resolve();
          const second = await permission("role");
          revalidatePath(`/projects/${identity}`);
          revalidatePath(`/projects/${identity}`);
          after((): void => undefined);
          return { first, second, cookie: (await cookies()).get("session")?.value };
        },
      );
    const [a, b] = await Promise.all([execute("a"), execute("b")]);
    expect(reads).toBe(2);
    expect(a.value).toEqual({
      first: "role:Bearer a",
      second: "role:Bearer a",
      cookie: "a=signed",
    });
    expect(b.value.cookie).toBe("b=signed");
    expect(a.invalidations.map((item) => item.path)).toEqual(["/projects/a"]);
    expect(b.invalidations.map((item) => item.path)).toEqual(["/projects/b"]);
    expect(a.afterEffects).toHaveLength(1);
    await execute("a");
    expect(reads).toBe(3);
  });

  test("does not cache across CLI calls or schedule without a request", (): void => {
    let reads = 0;
    const read = cache((): number => ++reads);
    expect(read()).toBe(1);
    expect(read()).toBe(2);
    expect(() => after((): void => undefined)).toThrow("konteks request");
  });

  test("portable navigation is explicit control flow", (): void => {
    expect(() => redirect("/login")).toThrow(RedirectControl);
    expect(() => notFound()).toThrow(NotFoundControl);
  });
});
