# Desktop modal dropdown audit

Status: complete.

## Scope

Audit every web modal/sheet dropdown and select consumer, including nested forms, across expenses, cash/payments/reconciliation, projects/RAP/RAB/packages/onboarding, materials/settings/administration/profile and AI review sheets. Canonical responsive web and native mobile fallback remain authoritative; no backend, permission, finance/material mutation or database reset is needed.

Use an exhaustive caller inventory, then exercise the actual shared adapters and overlay owners with safe fixtures. Cover ordinary and searchable AdaptiveSelect, ComboboxField/custom values, FilterSelect, option actions, explicit create actions, ActionMenu and nested ContextPopover. Inspect the data prerequisite and empty state at each feature caller, including empty-but-creatable lists and optional empty-value sentinels. Do not equate an empty value with an invalid choice or disable explicit reference creation just because no records exist yet.

## Verification and changes

- Build red-capable DOM regressions with two nested shared FormSheets. Assert popup/options visibility, enabled selection updating only local state, search, custom entry, disabled rows, outside dismissal, Escape/trigger focus restoration, and reference creation opening the next sheet after the selection exits.
- Verify shared behavior in the browser at 1024/1280/1440 and mobile 320/360/390/430, including safe representative feature fixtures, open/dirty resize, native fallback and reduced motion. Keep feature data in memory; user drafts are inspected read-only.
- Fix only verified failures at their owning seam. Preserve the public shared UI, HeroUI v3 selection/portal/motion contracts and one modal focus/dismissal owner. Add specific prerequisite feedback where a feature can otherwise present an unexplained empty dependent selector.
- Record exhaustive inventory, observed defects, delivered fixes and practical coverage in this document. Run web tests/build, TypeScript, lint, scoped formatting, HeroUI styles/token checks and diff checks. Generate API declarations sequentially to avoid concurrent emitter races; record unrelated failures separately.

## Initial evidence

The previous expense defect was an empty collection caused by opening Item 1 without a project. Its feature gate now has a regression. This audit additionally checks empty collections that must remain openable for a create action or free/custom entry, and the nested focus/layer lifecycle with actual available options.

## Delivered findings

1. **Empty desktop collections could not open.** Captured a failing real HeroUI Select inside two FormSheets with zero references and an explicit create action. The ordinary, search/custom and filter adapters now use React Aria's `allowsEmptyCollection`, so empty feedback, custom entry and existing create actions remain usable. Feature prerequisite/pending/permission gates and intentional empty-value choices remain authoritative.
2. **Desktop public Button dropped caller refs.** A callback-ref DOM assertion failed before the fix. Public Button now accepts and forwards its ref to the actual desktop/mobile button, matching IconButton. Nested ContextPopover selection and one-click trigger closing have regression coverage; no positioning/focus/dismissal owner was replaced.
3. **Vendor bill category lacked unavailable-context feedback.** Category selection now distinguishes no project, an unavailable restored project and a project without budget categories, with the existing pending gate. Its data and mutation callbacks remain unchanged.
4. **AI reconciliation account choices exceeded the action-menu limit.** Seven accounts previously threw the six-action menu limit. Account selection now uses public AdaptiveSelect, retaining local selection, original account identity and existing confirmation/commit guards. Tests include seven and 25 accounts, zero/one account and confirmed results.

## Source coverage

The durable inventory is `docs/qa/2026-10-13-desktop-modal-dropdown-inventory.json`. Exhaustive Graft discovery plus a production TSX AST crosscheck verified 137 call sites in 57 files: **91 modal/sheet dropdown/select sites** (72 AdaptiveSelect, 18 ComboboxField, one RAB ActionMenu), 27 adjacent page/inline/global controls, 16 calendars, one color picker and two selection owner/content sites. Two duplicated onboarding records were removed. No feature-local native select, private HeroUI import or replacement portal owner was found. Every inventoried feature retains its original state/domain callbacks and contextual options; creation, pending/disabled options, optional blank sentinels and asynchronous options are annotated.

Source coverage is exhaustive for these contracts. Runtime verification exercises the shared adapters and representative safe fixtures, rather than claiming that all 91 business call sites were individually clicked against tenant data.

## Runtime evidence

- Shared DOM regression uses actual DesktopUIProvider, two nested FormSheets and a third create form/confirmation. Covers empty normal/create/custom/filter lists, asynchronous choices arriving in an already-open menu, grouped and blank-sentinel options, disabled choices, searchable Select/filter, action-menu handoff, selection-triggered confirmation, nested ContextPopover, Escape and exact trigger focus restoration, reference-form focus ownership and disabled triggers. Ref and empty-create failures were recorded before their fixes.
- HappyDOM must bind CustomEvent from the same window realm as Event for React Aria focus restoration. The original harness mismatch was corrected while retaining exact focus assertions.
- Browser verification passed ordinary/search/filter/search-filter, empty custom, empty guidance, late-loaded options, create → third form → new selectable reference, selection → confirmation, action menu → compact form, and modal → ContextPopover → Select. Desktop 1024/1280/1440 and mobile 320/360/390/430 had usable choices without document overflow. A dirty input's value, DOM identity/focus and the selected reference survived desktop/mobile resize. Native fallback remained mobile at 1440. Reduced-motion create handoff preserved the next focus owner.
- A preliminary ContextPopover dismissal signal came from the locator helper's automatic scroll: React Aria's existing non-modal popover intentionally closes on ancestor scroll. Native pointer hit testing confirmed child selection keeps the parent open and one trigger click closes it after the Button-ref fix. No speculative change to native scroll/dismissal policy was retained.
- Browser-scoped viewport sizing and per-tab layout metrics can differ for native screenshots. Final proof uses a CDP screenshot with the verified CSS viewport clip; `/tmp/atria-dropdown-audit-proof/desktop-nested-create-final.png` is 1280×960. Browser layout measurements, rather than cropped native captures, establish the viewport matrix.

## Final checks

**1014 web tests passed, zero failed across 204 files.** API/mobile/web typechecks passed in sequence; web production build, workspace lint, scoped formatting, scoped HeroUI styles, native token synchronization and diff checks passed. Workspace lint retains one existing AI Material effect dependency warning unrelated to these changes. No API/business calculations, database writes/reset, finance/material commit or user draft changes were used during QA.

DESIGN, its sidecar and the shared manual-form surface brief document the collection/ref/handoff contract. The shared story and inventory remain as regression evidence. Temporary logs/proof are under `/tmp/atria-dropdown-audit-*`; browser emulation is restored and the task-only Storybook process is stopped after verification. User web/API processes remain running.
