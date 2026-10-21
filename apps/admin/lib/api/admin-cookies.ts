export const ADMIN_COOKIE_PREFIX = "atria-admin";
const backendPrefix = "better-auth";
const adminCookie = /^(__(?:Secure|Host)-)?atria-admin\./;
const backendCookie = /^(__(?:Secure|Host)-)?better-auth\./;

/** Ports share cookies: explicitly namespace admin sessions even on localhost. */
export function adminBackendHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  const cookies = (source.get("cookie") ?? "").split(";").flatMap((entry): readonly string[] => {
    const pair = entry.trim();
    const separator = pair.indexOf("=");
    if (separator < 1) return [];
    const name = pair.slice(0, separator);
    if (backendCookie.test(name)) return []; // Never borrow the mobile-web session.
    const canonical = name.replace(
      adminCookie,
      (_match: string, secure: string | undefined): string => `${secure ?? ""}${backendPrefix}.`,
    );
    return [`${canonical}${pair.slice(separator)}`];
  });
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  else headers.delete("cookie");
  return headers;
}

/** Keep attributes/value verbatim, including expired cookies and Secure prefixes. */
export function adminSetCookie(value: string): string {
  return value.replace(
    backendCookie,
    (_match: string, secure: string | undefined): string =>
      `${secure ?? ""}${ADMIN_COOKIE_PREFIX}.`,
  );
}

export function adminResponseHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  headers.delete("set-cookie");
  for (const value of source.getSetCookie()) headers.append("set-cookie", adminSetCookie(value));
  return headers;
}
