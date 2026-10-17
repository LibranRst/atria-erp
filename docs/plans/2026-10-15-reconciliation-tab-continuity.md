# Reconciliation desktop tab continuity

## Scope

Fix the reported desktop tab transition: switching Mutasi bank / Catatan Atria / Riwayat replaces the live tablist with a full body skeleton and interrupts the shared active-indicator animation. Preserve the accepted visual world, existing requests, canonical URL state, mobile/native composition, selection and workflow ownership.

Keep the last successfully read workspace metadata available independently of the active tab's rows. After initial loading, summary, tabs and filters stay mounted during tab reads and recoverable errors; loading is limited to the requested collection. Never render another tab's rows as the new collection or expose stale match actions. Reuse SegmentedTabs and its existing Framer Motion/reduced-motion contract, GroupedSurface, filter controls, PageState and the existing structural table skeleton. Do not add animation infrastructure, a cache policy, backend changes or financial mutations.

## Verification

1. Reproduce actual tab replacement and establish a failing deferred-read DOM regression before applying the fix.
2. Preserve the tablist DOM node, selected state and keyboard focus while loading; keep loading honest and ensure rapid switching rejects late responses.
3. Verify live app tab changes, all three collections, retry/filter behavior and desktop/mobile/native responsive presentation with read-only actions.
4. Run relevant tests, TypeScript, lint/format and shared style/token checks; update the surface brief and this record, then refresh Graft.

## Status

Completed. Plan was saved before executable changes.

The read hook intentionally has no rows for a different source while its request is pending. The presenter treated that state as initial page loading and replaced the summary, filters and SegmentedTabs with a full body skeleton. The shared tab indicator and focused tab were therefore unmounted.

The hook now retains only last-successful workspace metadata independently of the active collection. The presenter keeps its chrome mounted after first success, limits pending/error/retry to the collection, and derives no actionable row/detail until that collection is fresh. Existing selection, read cancellation, URL state, suspension and shared motion remain authoritative. No cache policy, write path or new primitive was introduced.

## Evidence and checks

- RED: `cd apps/web && bun test features/reconciliation/components/reconciliation-desktop-dom.test.ts` failed on the new assertion that the same live segmented navigation remains during a deferred tab read. Real dev tablist IDs also changed before the fix.
- GREEN: the same DOM suite passed in 4.40s. It uses the real hook/presenter/shared tabs with only deferred read responses mocked. Assertions cover tab DOM identity, selected state/focus, last-read counts, truthful collection loading, no other source's rows, rapid-switch races, error/retry/recovery, search/refresh/sort pending-action guards and restored explicit selection. Existing URL/hash, pagination, narrow selection and history-date checks remain green.
- Live dev: statement/cash/history switching retains the same tablist ID and focus; the active state updates immediately during pending reads. Final proof: `/tmp/atria-reconciliation-tab-continuity/tab-transition.png`. No match, import or finance mutation was performed.
- Responsive proof: desktop 1024/1280/1440px and mobile 320/360/390/430px screenshots have no document horizontal overflow. Native `surface=mobile` retains its mobile composition at desktop width. Temporary viewport overrides were reset and the canonical dev app remains open.
- API/web/mobile TypeScript passed. Workspace lint passed with the existing missing `accept` effect dependency warning at `material-master-proposal-card.tsx:171`. HeroUI scoped styles and token checks passed. Scoped formatting passed; global formatting still reports the same 83 pre-existing paths (`/tmp/atria-reconciliation-tabs-format.log`).
- A bounded independent review found no remaining actionable defect after the pending-detail guard. DESIGN, its sidecar and the route surface brief document persistent chrome/local loading. Graft refreshed after the changes.
