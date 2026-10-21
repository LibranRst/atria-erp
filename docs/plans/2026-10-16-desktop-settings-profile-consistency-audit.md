# Desktop Settings and Profile consistency audit

## Scope and authority

Audit all four canonical Settings tabs (Finansial, Katalog, Organisasi, Kesiapan) and Profile in the real development web app. Preserve the accepted Atria Operate identity and Dashboard/shared UI contracts. Inspect compact controls, source-backed hierarchy, complete tables and optional selection, URL state and visited-view continuity, keyboard/list-detail/modal focus, nested selectors, dirty and pending ownership, structural loading, error/restricted/empty distinctions, and responsive/native fallback.

Settings remains authoritative for defaults and reference data. Existing finance/material calculations, permission/tenant/project fences, system-role protections, explicit approvals and writer ownership remain unchanged unless a verified defect needs a separately tested correction. Profile changes remain tied to the authenticated actor.

## Execution

1. Read the Graft graph, skills, PRODUCT, DESIGN, sidecar, surface briefs and public shared UI inventory. Run parallel scoped code audits, with one root browser owner for live evidence.
2. Record concrete verified defects, then coordinate one fix batch through existing primitives. Use focused real-owner behavior tests for interaction/state changes and disposable/mocked fixtures for mutation/permission scenarios.
3. Perform one bounded final desktop/mobile review at 1024/1280/1440 and 320/360/390/430, plus native fallback. Check initial optional selection, exact-row Back/focus, visited views and URL controls, nested menus, resize, local draft cancellation, truthful sources and permission-limited actions.
4. Live QA is read/navigation/local unsaved draft/overlay only. Do not change passwords, upload profile images, subscribe push, switch simulated actors, sign out, edit users/roles/settings, save defaults, approve/post stock, seed/reset or otherwise write development data. Do not bypass permissions.
5. Run scoped regressions and appropriate workspace tests, TypeScript, lint, format, token/scoped HeroUI checks and isolated build. Avoid heavy builds/types during timed DOM fixtures. Preserve the running dev services and original generated Next references. Update design/surface guidance for changed contracts and refresh Graft after substantive source changes.

## Acceptance record

Status: complete; **ship**. Verified in the existing authenticated Owner session on port 3004; no development writes were performed.

### Verified findings

- **P1 — Tenant boundaries in Settings reads.** A disposable two-tenant fixture reproduced foreign staff/vendor/opening history entering administration and foreign foundation records affecting readiness, plus foreign movement/opening records affecting initial-stock eligibility. Harden the affected read predicates, including the Settings overview source, with the existing instance tenant contract. Global role definitions retain their established contract. This is fixture evidence, not a claim that foreign data was observed in the development app.
- **P2 — Catalog and organization context loss.** Live Material search `Multipleks` → Library → Material reset the search. Live Team → Vendor → Finansial → Organisasi returned to Team with empty search. Persist collection/entity/filter/sort/page context through existing URL helpers while preserving financial dirty/discard ownership; do not retain hidden editors.
- **P2 — False source states.** Settings source failures were converted to null/empty arrays, disappearing thresholds, false restriction or empty initial-stock history. Preserve per-source readiness/restriction/unavailability with retry; reject stale authority for affected setup actions.
- **P2 — Permission affordances.** Vendor creation in a Material editor followed material-management permission rather than vendor permission. Initial-stock creation/decision controls did not follow their separate writer rights. Preserve ordinary selection and read-only history; gate only the affected actions.
- **P2 — Profile focus after resize.** Confirmed live: Ubah profil at 1440px → resize 390px → clean close → zero dialogs but BODY focus. Preserve logical return context through the existing sole overlay owner. Regression fixtures also cover dirty edit cancel/discard, empty password close and permission details.
- **P2 — Historical desktop permission presentation.** Profile still treated compatibility-only `use:desktop_admin` as a Workspace requirement. Hide it and any resulting empty group in display summaries only; authorization catalog/grants remain unchanged.
- **P2 — Structural and accessible presentation.** Profile desktop loading does not match the current account/table hierarchy; initial-stock page title/history scaffold needs correct semantics. Catalog entity badges incorrectly announce risk, and Library category choices expose raw codes. Correct these through incumbent shared primitives and supplied readable facts.

### Positive boundaries retained

Complete authorized collections sort before pagination with truthful totals. Initial desktop context tables have no forced selected row. Existing shared form/overlay dirty and pending owners, financial default applicability, Owner/system-role protections, actual DB permissions, actor-bound profile writes and password-session revocation remain authoritative. Mobile-only installation guidance stays hidden on desktop. Deterministic Impeccable scan before changes returned no findings; behavior/source defects above were verified separately.

### Final fixes and source boundaries

All listed findings are fixed. Specialized Settings refresh readers now share the initial-load tenant predicates, preventing an ordinary Material/Library refresh from restoring foreign references. Role definitions remain global, while displayed user counts use the same tenant membership boundary as Team. Administration accepts refreshed rows/capabilities when idle, defers the latest source while user/vendor/role work is open or pending, and applies it after close; actual-owner regressions preserve dirty cancellation and cover capability revocation and role fallback. No grant, role writer or deletion protection was altered.

Shared UI reused: DesktopTable, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect/AdaptiveSelect, PageState, GroupedSurface, existing form/confirmation/detail sheets and their logical return-focus contract. OperationalFormSheet received only optional `returnFocusRef` forwarding. No new primitive, focus trap, modal owner, visual token, formula or database migration was introduced.

### Bounded live acceptance

Actual app on port 3004, authenticated as the existing Owner Ronald Wijaya. Profile, Finansial, Material Master, Library, Lokasi, Tim, Vendor, Peran, Kesiapan and initial-stock flow passed 1024/1280/1440 and 320/360/390/430 checks: **70 layout checks over 10 surfaces**, with no document overflow and expected desktop tables/mobile composition. Context tables start unselected. Both canonical pages retained the 448px mobile composition at desktop width with `surface=mobile`, without desktop tables or overflow.

- Profile name edit survived desktop→390px with the same input/value/focus; cancel preserved the draft, and discard returned focus to the visible Identitas akun section after dialog exit. No save or upload occurred. Permission detail preserved missing rights and returned to the visible Hak akses section after resize. Empty-password close is covered by the real-owner fixture; no credentials were entered in the live app.
- Profile now shows eight actual domain groups, without the compatibility Workspace requirement. Other missing/granted rights remain visible.
- Material search `Multipleks` survived Library and main Finansial round trips, with prefixed URL state and no skeleton reset. Organization returned to Vendor after a main-tab round trip, and returning to Tim restored its independent Budi search. Visited Roles returned without another source skeleton.
- Library's nested category menu opened, showed supplied readable descriptions and accepted Material. The local QA change was discarded through the existing confirmation, without creating a template.
- Initial-stock flow retained its read-only posted/history context and now has its own h1. No stock declaration, opening submission, approval, financial default, user, vendor or role was changed.
- A fresh Role read showed Owner holder count one, consistent with the scoped Team source. No user record was removed; only the read boundary changed.

Evidence directory: `/tmp/atria-settings-profile-audit-2026-10-16/`, including `viewport-matrix.json`, synchronized `profile-final-1440.png` and `profile-final-320.png`, `settings-financial-final-1440.png`, and native-fallback evidence. Before/failure captures are diagnostic only. Final screenshot acceptance uses synchronized state/render capture.

### Quality gates and technical audit result

- Full workspace suite: **2,709 pass, 560 configured integration skips, zero failures**, including 1,214 web and 841 API passes. After the bounded Role-count correction, the focused API suite passed **13 tests / 38 assertions**, covering actual disposable two-tenant reads, role counts and existing effective-permission/Owner protections.
- Focused Profile: 34 web tests / 118 assertions plus two API display-permission tests / nine assertions. Catalog: 13 tests / 53 assertions. Organization/readiness: six web tests / 17 assertions, including actual source adoption, dirty/pending owners and source/capability states. Heavy checks ran after timed DOM fixtures.
- API/web/mobile TypeScript and API declaration generation passed. Workspace lint has zero errors/warnings. Global Prettier, semantic token and scoped HeroUI style checks passed. API build and isolated web production build (`.next-settings-profile-audit-build`) passed; original generated Next references were restored to preserve development setup.
- Deterministic Impeccable detector before and after changes: no findings. Independent read review confirmed the tenant/source/capability boundary, including specialized refresh readers. Graft refreshed after source changes.

| Dimension                | Score     | Bounded evidence                                                                                                       |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3/4       | Keyboard/AX, labels, logical return focus, inert skeletons; no claim of exhaustive assistive-technology certification. |
| Performance              | 3/4       | Visited views retain data and URL context without repeated skeletons; no production profiling claim.                   |
| Responsive design        | 4/4       | Ten surfaces at seven widths, native fallback, dirty/focused resize and nested overlays.                               |
| Theming                  | 4/4       | Incumbent light Atria tokens, shared HeroUI adapters and scoped-style checks; no new palette.                          |
| Implementation integrity | 4/4       | Honest source states, independent capabilities, tested tenant fences, unchanged explicit writer ownership.             |
| **Total**                | **18/20** | **Excellent within the audited scope.**                                                                                |

Implementation integrity verdict: pass. Independent Impeccable finish review: **disposition: ship**, no material fixes. The incumbent desktop shell, compact controls, Profile topology/mobile adaptation, Settings financial hierarchy, explicit simulation/applicability copy, typography and surfaces match the persisted authority. No unresolved material finding remains.

Final validation logs: `/tmp/atria-settings-profile-workspace-tests.log`, `/tmp/atria-settings-role-count-final-tests.log`, `/tmp/atria-settings-profile-types.log`, `/tmp/atria-settings-profile-lint.log`, `/tmp/atria-settings-profile-format.log`, `/tmp/atria-settings-profile-api-build.log`, `/tmp/atria-settings-profile-web-build.log`, `/tmp/atria-settings-profile-detector-final.json` and the focused Profile/Catalog/Organization logs noted in this task. Final dev preview: `/tmp/atria-settings-profile-audit-2026-10-16/final-dev-preview.png`. Viewport restored, no open overlay or local QA draft remains.
