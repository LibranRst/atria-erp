import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";

const browserWindow = new Window({ url: "https://atria.test/admin/projects?filter=ACTIVE#review" });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
mock.module("next/navigation", () => ({
  useRouter: (): { push: (href: string) => void } => ({ push: (): void => undefined }),
  usePathname: (): string => "/admin/projects",
  useSearchParams: (): URLSearchParams => new URLSearchParams("filter=ACTIVE"),
  useParams: (): Record<string, string> => ({}),
  useSelectedLayoutSegment: (): null => null,
  useSelectedLayoutSegments: (): readonly string[] => [],
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));
mock.module("next/link", () => ({
  // Like Next's Link, `onNavigate` is consumed by the router and never reaches the anchor.
  default: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { onNavigate?: unknown }): React.JSX.Element => {
    const anchorProps = { ...props };
    delete anchorProps.onNavigate;
    return <a {...anchorProps}>{children}</a>;
  },
}));
let homeDestination = "/ledger";
mock.module("../../app/actions/auth-navigation", () => ({
  getPostLoginRedirectDestination: async (): Promise<string> => homeDestination,
}));
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { default: legacyPage } = await import("../../app/admin/[...workspace]/page");
const { default: legacyHome } = await import("../../app/admin/page");
const { LegacyWorkspaceRedirect } =
  await import("../../components/layout/legacy-workspace-redirect");
const replacements: string[] = [];
Object.defineProperty(window.location, "replace", {
  configurable: true,
  value: (href: string): void => {
    replacements.push(href);
  },
});
const page = await legacyPage({
  params: Promise.resolve({ workspace: ["projects"] }),
  searchParams: Promise.resolve({ filter: "ACTIVE" }),
});
const html = renderToStaticMarkup(page);
assert.ok(html.includes('role="status"'));
assert.ok(html.includes('href="/projects?filter=ACTIVE"'));
assert.deepEqual(replacements, []);
const nativePage = await legacyPage({
  params: Promise.resolve({ workspace: ["projects", "p-1"] }),
  searchParams: Promise.resolve({ tab: "budget", filter: ["ACTIVE", "RISK"], surface: "mobile" }),
});
const nativeHtml = renderToStaticMarkup(nativePage);
assert.ok(
  nativeHtml.includes(
    'href="/projects/p-1?tab=budget&amp;filter=ACTIVE&amp;filter=RISK&amp;surface=mobile"',
  ),
);
const homeHtml = renderToStaticMarkup(
  await legacyHome({ searchParams: Promise.resolve({ surface: "mobile" }) }),
);
assert.ok(homeHtml.includes('href="/ledger?surface=mobile"'));
const rootAlias = await legacyHome({ searchParams: Promise.resolve({ tab: "budget" }) });
assert.ok(renderToStaticMarkup(rootAlias).includes('href="/ledger?tab=budget"'));
homeDestination = "/onboarding?step=welcome";
const onboardingAlias = await legacyHome({
  searchParams: Promise.resolve({ step: "budget", tab: "budget" }),
});
assert.ok(
  renderToStaticMarkup(onboardingAlias).includes('href="/onboarding?step=welcome&amp;tab=budget"'),
);
homeDestination = "/profile/password";
const passwordAlias = await legacyHome({ searchParams: Promise.resolve({}) });
assert.ok(renderToStaticMarkup(passwordAlias).includes('href="/profile/password"'));
homeDestination = "/login";
const anonymousAlias = await legacyHome({ searchParams: Promise.resolve({}) });
assert.ok(renderToStaticMarkup(anonymousAlias).includes('href="/login"'));
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async (): Promise<void> => {
  root.render(page);
  await Promise.resolve();
});
assert.deepEqual(replacements, ["/projects?filter=ACTIVE#review"]);
await act(async (): Promise<void> => {
  root.render(rootAlias);
  await Promise.resolve();
});
assert.equal(replacements.at(-1), "/ledger?tab=budget#review");
await act(async (): Promise<void> => {
  root.render(passwordAlias);
  await Promise.resolve();
});
assert.equal(replacements.at(-1), "/profile/password#review");
await act(async (): Promise<void> => {
  root.render(nativePage);
  await Promise.resolve();
});
assert.equal(
  replacements.at(-1),
  "/projects/p-1?tab=budget&filter=ACTIVE&filter=RISK&surface=mobile#review",
);
const before = replacements.length;
await act(async (): Promise<void> => {
  root.render(<LegacyWorkspaceRedirect canonicalHref="//example.com" />);
  await Promise.resolve();
});
assert.equal(replacements.length, before);
await act(async (): Promise<void> => {
  root.unmount();
  await Promise.resolve();
});
await assert.rejects(
  () =>
    legacyPage({
      params: Promise.resolve({ workspace: ["unknown"] }),
      searchParams: Promise.resolve({}),
    }),
  /NOT_FOUND/,
);
console.log("legacy fragment bridge passed");
