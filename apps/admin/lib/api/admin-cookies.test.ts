import { describe, expect, test } from "bun:test";
import { adminBackendHeaders, adminResponseHeaders } from "./admin-cookies";

describe("independent admin cookie session", (): void => {
  test("selects only admin credentials when both localhost frontend sessions exist", (): void => {
    const headers = adminBackendHeaders(
      new Headers({
        cookie: "better-auth.session_token=web; atria-admin.session_token=admin; preference=one",
      }),
    );
    expect(headers.get("cookie")).toBe("better-auth.session_token=admin; preference=one");
    expect(
      adminBackendHeaders(new Headers({ cookie: "better-auth.session_token=web" })).has("cookie"),
    ).toBe(false);
  });

  test("preserves HTTPS secure prefixes and keeps logout restricted to admin", (): void => {
    expect(
      adminBackendHeaders(
        new Headers({
          cookie:
            "__Secure-better-auth.session_token=web; __Secure-atria-admin.session_token=admin",
        }),
      ).get("cookie"),
    ).toBe("__Secure-better-auth.session_token=admin");
    const upstream = new Headers();
    upstream.append(
      "set-cookie",
      "__Secure-better-auth.session_token=; Max-Age=0; HttpOnly; Secure; Path=/",
    );
    upstream.append(
      "set-cookie",
      "better-auth.session_data=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/",
    );
    expect(adminResponseHeaders(upstream).getSetCookie()).toEqual([
      "__Secure-atria-admin.session_token=; Max-Age=0; HttpOnly; Secure; Path=/",
      "atria-admin.session_data=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/",
    ]);
  });
});
