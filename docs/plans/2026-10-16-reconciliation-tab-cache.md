# Reconciliation desktop tab page retention

## Scope

The desktop reconciliation hook currently retains only one response. Every source change discards the previous tab page, so returning to a visited tab fetches again and shows the table skeleton. Project tabs retain their supplied data and do not have this repeated loading transition.

Retain the last successful exact-query page for each of the three reconciliation views in the existing mounted hook. Reusing a valid page must be synchronous and issue no duplicate read. Keep memory bounded to one page per view; do not add persistent/global storage, dependencies, prefetch requests, backend changes or altered server-side pagination. First visits and uncached filter/sort/page inputs retain honest collection loading.

Explicit Segarkan/retry or a changed parent refresh token invalidates all cached pages before reading the current view. Parent mutation refresh remains authoritative, and opening an overlay suspends reads without replacing drafts. Keep source errors visible, cached identities scoped to their query and refresh generation, late responses ignored, and prior detail actions hidden during a genuinely pending collection. Existing nullable row selection, stable tabs, URL/filter state, mobile/native presentation and shared overlay ownership remain intact.

## Verification

Use the existing deferred-read real hook/presenter DOM seam to show the failing visited-tab roundtrip first, then verify synchronous cached return with no skeleton/read, exact query isolation, refresh/retry/token invalidation, out-of-order responses, errors and suspended reads. Preserve existing selection/resize/source honesty cases. Verify real dev source-tab roundtrips and required responsive widths without matching or changing financial data.

Run scoped tests, TypeScript, workspace lint and formatting, shared styles/tokens as appropriate; update DESIGN/sidecar/surface brief and refresh Graft. Reuse public SegmentedTabs, DesktopTable, PageState and the existing structural skeleton; no new UI primitive or visual world.

Status: completed. Plan was saved before executable changes. Scope is visited exact-query page retention; no background prefetch.

## Results

- The existing mounted read hook retains one exact-query result per view (at most three), scoped by parent refresh token and local reload generation. Successful revisits reuse the displayed page synchronously and skip the API. Failed queries retain an explicit local error until retry/query change and never return healthy rows. Metadata/time describe the displayed cached page.
- Segarkan/retry invalidates all three views. The workflow owner also immediately advances its refresh token after successful mutations, while pending/open work suspends reads; parent refresh remains authoritative. Unauthorized/forbidden results purge all retained pages and metadata. Late superseded results are ignored.
- Independent review caught candidate detail reuse through an unchanged cached timestamp. Detail results now additionally match the current selected-row source reference, so a cached table returns instantly while candidate/action evidence is read again. Existing explicit matching and server authorization remain unchanged.
- RED: the deferred actual-hook/presenter regression observed 13 reads instead of the expected 12 after returning to a previously visited source. GREEN: the expanded existing fixture verifies zero additional collection reads and no table skeleton on valid return; exact query/page namespaces; global token/reload invalidation; suspended/inactive reads; late results; failed-source retry; permission denial purge; and fresh candidate context before actions.
- The complete scoped reconciliation suite passes: 11 tests, zero failures, 39 wrapper/unit assertions across five files. Its real DOM subprocess also retains optional selection, keyboard/focus, URL/hash, pagination, responsive Back, source freshness and exact-value scenarios.
- Real dev A→B→C→A and subsequent loops display the correct tables with no visible skeleton after each source has loaded. Desktop 1024/1280/1440px repeat transitions retain that behavior with no horizontal overflow; mobile 320/360/390/430px remains unchanged. Viewport overrides were reset. Evidence: `/tmp/atria-reconciliation-tab-cache-2026-10-16/checks.json`, `cached-return.png` and breakpoint screenshots. The canonical dev workspace remains open; no match/import/payment/data mutation was performed.
- Web TypeScript and production build passed using isolated `.next-reconciliation-cache-build`. Workspace lint passes with zero warnings/errors; global format check remains clean. DESIGN, its sidecar and the surface brief document the retention/error/invalidation policy. Graft refreshed after the changes.
- Logs: `/tmp/atria-reconciliation-tab-cache-{tests,typecheck-final,lint,format,build}.log`. First visits, genuinely uncached inputs, explicit refresh and invalidated generations still load honestly. No persistent cache, TTL, new shared primitive, backend query or database change was introduced.
