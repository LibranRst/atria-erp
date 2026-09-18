# PWA Foundation and Mobile Notification Readiness

**Date:** 2026-09-12
**Related:** `docs/plans/2026-09-07-notification-delivery-completion.md`, `docs/plans/2026-09-12-native-notification-banner-reliability.md`, `docs/guide/notifications.md`, `docs/guide/vercel-deployment.md`

## Objective

Make Atria installable as a Home Screen app on iOS and Android, and make that
installation the supported path to browser push. iOS Safari only exposes
`PushManager`/`Notification` to a web app that has been added to the Home Screen;
without a manifest, icons, standalone display mode and an app-wide service
worker, the existing Web Push opt-in control cannot work at all on iPhone.

## Scope

1. **Manifest** — `app/manifest.ts` exporting a typed `MetadataRoute.Manifest`.
2. **Icons** — real PNG files under `public/icons/`, derived from the existing
   shipped mark, at verified dimensions.
3. **Root metadata and viewport** — `manifest`, `applicationName`, `appleWebApp`,
   the legacy `apple-mobile-web-app-capable` meta, apple touch icon, and
   `themeColor` on the exported `viewport`.
4. **Service worker** — `install`/`activate`/`fetch` added to the existing
   `public/notification-sw.js` in place, plus `icon`/`badge`/`lang`/`dir` on the
   existing push notification.
5. **Offline fallback** — `app/offline/page.tsx`, precached at install time.
6. **App-wide registration** — `lib/pwa/service-worker.ts`, `lib/pwa/install.ts`,
   and `components/layout/pwa-registrar.tsx` mounted once in the root layout.
7. **Install surface** — `features/pwa/components/install-app-control.tsx`,
   rendered on `/notifications` directly under `WebPushControl`.
8. **Cache headers** — `headers()` in `next.config.ts` for the worker path.

## Decisions

### `start_url` is `/`

`/` is the only address that is correct for an authenticated owner and a
logged-out one. The server resolves it — `app/page.tsx` calls
`resolveHomeDestination` for a real actor and `redirect("/login")` otherwise — so
the installed app always opens on a working screen. Any deep route is wrong for
one of the two states: `/ledger` bounces a session-less launch to `/login`, and
the user's first impression of their installed app is a login wall.

### `orientation: "portrait"`

Matches the mobile shell, which is a fixed `max-w-md` column with a `px-1`
content inset and a floating bottom nav. Nothing in the app is designed to be
read sideways.

### Icons come from the existing shipped mark

`PRODUCT.md` records honestly that no Dekoria brand kit exists beyond
`apps/web/app/favicon.ico`, and that favicon is a leftover Vercel template mark.
The only mark this product actually ships to users is the Expo app icon:
`apps/mobile/assets/images/icon.png` (1024×1024, opaque, blue gradient with a
white chevron mark) — that is the icon on the mobile client's Home Screen today.
This workstream reuses it rather than inventing artwork, so the web install and
the native app look identical on one device.

| Output                  | Source                             | Transform                                                      |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `icon-192.png`          | `icon.png` 1024²                   | LANCZOS to 192², alpha flattened on white                      |
| `icon-512.png`          | `icon.png` 1024²                   | LANCZOS to 512², alpha flattened on white                      |
| `icon-maskable-512.png` | `android-icon-foreground.png` 512² | transparent mark composited on `#f5f5f7`                       |
| `apple-touch-icon.png`  | `icon.png` 1024²                   | LANCZOS to 180², flattened (Apple composites alpha onto black) |
| `badge-72.png`          | `android-icon-monochrome.png`      | mark cropped to its bbox, drawn white at 72px                  |

The maskable entry uses `android-icon-foreground.png`, the same source
`apps/mobile/app.json` feeds to the Android adaptive icon
(`backgroundColor: "#F5F5F7"`), so the Android adaptive rendering and the PWA
maskable rendering agree. Its mark occupies roughly 43% of the canvas width,
well inside the 80% maskable safe zone, so no mask shape clips it.

`badge-72.png` is a white silhouette on transparency: Android renders the badge
as a monochrome mask, so a coloured or low-contrast badge disappears in the
status bar.

### `viewportFit` stays at its default

`apps/web/app/globals.css` defines no `--safe-area-inset-*` value, and
`apps/web/components/layout/mobile-shell.tsx` plus
`apps/web/components/layout/bottom-nav.tsx` clear the bottom inset with
`env(safe-area-inset-bottom)` only — in the shell's bottom padding and the
floating nav's `bottom` offset. Nothing in the app handles
`env(safe-area-inset-top)`: the fixed header is a plain 56px band
(`TOP_BAR_BAND_PX`) with no inset compensation.

Adding `viewportFit: "cover"` without top-inset handling would render the header
band under the status bar and the notch on every installed iPhone — the exact
opposite of the intent. `viewportFit` therefore stays unset and the browser keeps
the layout viewport inside the safe area. Top-inset support is a separate change
to `AppTopBar`, not a metadata flag.

### `apple-mobile-web-app-capable` is emitted explicitly

Next 16 emits `mobile-web-app-capable` from `appleWebApp.capable: true`, but not
the legacy `apple-mobile-web-app-capable` name that iOS 16.3 and earlier read.
Without it, an older device adds Atria to the Home Screen and launches it inside
Safari — where `PushManager` is never exposed — so the install would appear to
succeed and push would still be unavailable. It is declared through
`metadata.other`.

### The service worker file keeps its name and path

`public/notification-sw.js` is already registered in users' browsers and is the
worker the iOS push subscription flow depends on. Renaming it would orphan every
live registration. The offline caching is therefore added to the existing file in
place, not split into a second worker (two workers on one scope is not possible).

### The fetch handler is navigate-only, network-first

This is a financial ERP, so stale balances are worse than a missing page. The
`fetch` handler returns early — never calling `respondWith` — unless the request
is a same-origin document navigation that is not an RSC request (`?_rsc=`) and
not under `/api/`. API responses, RSC payloads, HTML documents, `_next/static`
chunks, images and every cross-origin request pass straight through to the
network and are never cached. The only cached resource is `/offline`.

When a navigation fails offline, the precached `/offline` page is served. It
never falls back to `index.html` or to another route's HTML, and `proxy.ts`
excludes the worker, the manifest, the icons and `/offline` from the auth gate so
they are reachable without a session and precache correctly.

### Registration moved to app startup

Registration used to happen only when the user pressed **Aktifkan** on
`/notifications`. That made `/offline` unreachable (no worker was installed until
the user opted into push) and frequently missed `beforeinstallprompt`, which
Chrome fires once per visit. `PwaRegistrar` registers the worker and arms the
install-prompt capture on mount, for the whole app. It is non-visual and never
requests notification permission: permission is still only requested from an
explicit click.

### `resolveInstallSurface` gains `browser-menu`

`beforeinstallprompt` fires at most once per visit and is consumed by the first
`prompt()`. A user who dismisses the dialog, or whose browser withholds the event
because the app was previously installed and removed, will not produce it again
that visit. Hiding the surface then would hide the only remaining way to install,
so Android/desktop without a retained prompt shows manual menu instructions
instead of nothing.

The mapping logic is separated from the DOM reader
(`resolveInstallEnvironment`/`resolveInstallSurface` are pure;
`readInstallEnvironment` reads globals) so the rules that are expensive to get
wrong — iPadOS reporting itself as macOS, iOS Chrome not having Safari's share
sheet, iOS locking push behind installation — are unit-testable.

## Verification performed

All commands run from the repository root unless noted.

| Check                    | Command                                                                                           | Result                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install mapping tests    | `cd apps/web && bun test lib/pwa/install.test.ts`                                                 | 8 pass, 0 fail                                                                                                                                                                                                                   |
| Manifest response        | `curl -D - localhost:3000/manifest.webmanifest`                                                   | 200, `application/manifest+json`, all fields present                                                                                                                                                                             |
| Worker headers           | `curl -D - localhost:3000/notification-sw.js`                                                     | `Cache-Control: public, max-age=0, must-revalidate`, `Service-Worker-Allowed: /`                                                                                                                                                 |
| Emitted metas            | `curl -s localhost:3000/offline \| grep -oE '<meta name=...'`                                     | `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `-title`, `-status-bar-style`, `theme-color`, `application-name`, `<link rel="manifest">`, `<link rel="apple-touch-icon">`                                             |
| Offline route            | `curl -o /dev/null -w "%{http_code}" localhost:3000/offline`                                      | 200, Indonesian copy present                                                                                                                                                                                                     |
| Worker behaviour         | throwaway harness executing the real `notification-sw.js` in a stubbed `ServiceWorkerGlobalScope` | 22/22 checks: navigate/direct/`/api/`/`?_rsc=`/cross-origin classification, install precache, offline fallback and 503 fallback, stale-cache deletion, push options and destination allowlist                                    |
| Install surface at 390px | headless Chromium with emulated iOS Safari / Android Chrome / macOS Chrome user agents            | iOS Safari shows the Home Screen steps, installed shows no pitch, Android with a retained prompt shows **Pasang aplikasi** which calls `prompt()` and confirms, Android/desktop without a prompt shows browser-menu instructions |

Icon dimensions as reported by `sips -g pixelWidth -g pixelHeight -g hasAlpha`:

```
icons/icon-192.png           192 x 192   hasAlpha: no
icons/icon-512.png           512 x 512   hasAlpha: no
icons/icon-maskable-512.png  512 x 512   hasAlpha: no
icons/apple-touch-icon.png   180 x 180   hasAlpha: no
icons/badge-72.png            72 x  72   hasAlpha: yes
```

## Not covered here

- Top-inset handling for the fixed header (see the `viewportFit` decision).
- Notification delivery, subscription registration and the VAPID pipeline are
  owned by `docs/plans/2026-09-12-native-notification-banner-reliability.md`.
- No offline write queue: the app deliberately keeps financial data
  network-only.
