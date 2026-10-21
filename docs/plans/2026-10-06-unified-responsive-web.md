# Unified responsive Atria web

Date: 2026-10-06
Status: first combined slice implemented and verified; awaiting user visual review before remaining module acceptance/final standalone cleanup.

## Confirmed decisions

- One apps/web presentation client and existing web login/session, canonical URLs for mobile and desktop. Keep apps/api business execution and native Expo unchanged.
- All authenticated roles receive the layout appropriate to their viewport; domain permissions and assigned-project scope continue to authorize every read/mutation. The legacy use:desktop_admin gate is no longer needed for responsive presentation; preserve grant rows/migration history during transition.
- Automatic desktop presentation at >=1024px, mobile below, with native surface=mobile fallback still pinned. Resize changes layout without navigation, losing drafts/selection, or swapping active dialog ownership.
- Keep Atria Manrope, ink/terracotta, cool semantic surfaces, money/status/icon grammar and shared overlay/motion ownership. Adopt compact HeroUI v3 controls/tables (fine-pointer desktop 32–40px) instead of forcing mobile 48px geometry; retain appropriate touch targets on mobile/coarse-pointer use.
- Reuse useful standalone compact Project/Budget work and the existing complete web workflows. No backend, finance/material math, ledger/stock/audit or Settings duplication.
- First review is unified shell + Dashboard/Proyek/Budget. Then polish/verify remaining workflow desktop presentation, followed by removal of apps/admin and legacy /admin renderer. Old links retain IDs/query/hash via canonical redirects. This slice is not final cutover.

## Implementation slice

1. Make workspace providers/route children/portal ownership stable. Derive presentation from viewport/native hint rather than pathname or desktop grant. Keep controlled domain draft state above any presentation swap and keep active overlay/form controls stable through resize.
2. Canonicalize navigation/history/login destinations. Remove desktop entry redirects/switch controls from the new responsive flow. Preserve authorization/public/API paths, native fallback and existing full workflow access.
3. Keep selective Hero CSS scoped to desktop content/portal. Remove mobile geometry coercion, forward native size variants and bridge only Atria identity tokens. Public shared UI remains the only primitive owner.
4. Adapt desktop Dashboard and Project/Budget comparisons/forms using existing loaders/actions/hooks. Maintain all project tabs, RAP/RAB/packages/invoices/closing capabilities and full existing mobile behavior.
5. Update product/design/agent documentation and mark standalone direction superseded; keep standalone runtime/tooling until final accepted removal. Existing startup presets continue during this review stage.
6. Validate same-URL behavior, all-role domain restriction, query/hash/history, drafts/selection/focus/dialog resize, typography/controls, desktop1024/1280/1440 and mobile320/360/390/430. Run targeted/full safe tests, TypeScript, lint, builds, scoped CSS/token/format checks. No development DB mutations.

## Design contract

Operate mode. Inherit the existing Atria world. Desktop earns density through grouped owning surfaces, compact native HeroUI controls, sidebar/context panels and financial tables; mobile remains its reference composition. No global Hero theme/reset, no arbitrary new palette/shadows, no duplicate focus traps or feature-owned controls.

## Verification and remaining work

- Canonical same-session web now adapts at1024px for every authenticated role; domain/scope guards remain authoritative. Old /admin links use a safe client compatibility bridge preserving IDs, repeated query values, native hint and browser hash; root alias resolves the existing login/password/onboarding/home policy.
- Shared focused controls/overlays, workflow providers, main children and portal destinations retain DOM/state through resize. Browser proof retained draft Proyek Draft Resize, exact focused input node, dialog and portal at1280→390→1440, with unchanged /projects URL and no page overflow. Project table selection survived resize.
- Atria themed compact Hero controls/tables, financial-first Dashboard and Project/Budget layouts are implemented. Default category order follows Settings/server order; explicit user sorts persist above responsive branches. Existing mobile workflows and full project tabs are retained.
- Initial combined full suite:1,739 pass, zero failures;164 disposable-DB cases skipped. API/web/mobile TypeScript, workspace lint, web production build, scoped Hero CSS/token checks and targeted format/diff checks pass. Repository-wide formatting still has123 pre-existing failures outside this implementation.
- Browser QA used only an isolated in-memory synthetic API. Desktop1024/1280/1440 and mobile320/360/390/430 showed no document overflow. Custom ASSIGNED role without legacy desktop grant received desktop and only permitted project actions; native surface=mobile kept448px layout at1440. Legacy project, Ledger and home hashes were explicitly verified after the bridge repair.
- Independent finish verdict:ship. Four material findings (category order, duplicate desktop risk preview, desktop loading, stale authority paragraphs) were resolved in one batch. Root design/sidecar were documented from built behavior while preserving mobile tokens/examples.
- No database/account/finance/stock mutations, resets, deployments, or user dev-process stops were performed. apps/admin and its startup/origin/cookie tooling remain transitional until accepted cleanup; its runtime is not used by unified web.
- Review preview:synthetic API3441 + web3430; normal startup remains bun run dev:web-api (API3001/web3003). All remaining module acceptance and standalone cleanup are outstanding.
