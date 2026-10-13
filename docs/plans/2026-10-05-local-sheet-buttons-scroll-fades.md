# Local web sheet lifecycle, button feedback and floating fades

## Requested behavior

1. Editing a project must close with the same downward exit as other sheets. Audit all web sheet owners for early unmount or lost selected data.
2. Action buttons use the existing shared capsule Button/IconButton, semantic resting depth and scale-up press/hold feedback. Audit motion/CSS press overrides that still shrink controls, including local draft confirmation.
3. The floating top/bottom chrome should fade smoothly into content like the established iOS app.

## Implementation direction

- Scope is local web development only. Preserve current user drafts/data, backend workflows, and unrelated workspace changes. Do not publish, push the deploy branch, reset or seed data.
- Sheet continuity: keep the component and selected data alive until its exit completes. Reuse useAnimatedSheetClose/useSheetPresenceValue and existing semantic sheet wrappers. Preserve dirty/pending dismissal decisions, backdrop/Escape/header close, focus restoration, keyboard viewport handling and reduced motion.
- Button feedback: shared Button is already scale-up through buttonTapActiveScale=1.05. Migrate feature action buttons that duplicated flat button markup; replace remaining shrinking press targets with the shared motion token. Keep disabled/pending behavior, semantic destructive emphasis, accessible labels and effective 48px targets. Large row/data surfaces keep their current layout and hierarchy.
- Scroll-edge material: use a shared semantic multi-stop scrim in globals.css for floating top/bottom chrome. Extend the fade distance with a gradual opacity ramp, preserve safe-area clearance and pointer-events-none, and avoid new animated blur/decorative layers.
- Update DESIGN.md/sidecar tap contract to match the explicit user direction; reuse existing shadow/motion tokens rather than introducing component-local values.

## Verification

Keep an exhaustive source inventory of sheet mounts and shrinking presses. Add meaningful lifecycle coverage for a parent that unmounts on close and a dirty form that requires confirmation. Verify button hold/release and reduced-motion states on synthetic controls. Inspect local project edit close without saving business data; use isolated Storybook fixtures for destructive/dirty flows. Verify mobile 320/360/390/430 and desktop 1024/1280/1440 with scroll-edge content and modal overlays. Run appropriate frontend tests, lint/typecheck and a web build; do not claim browser tests for every data-dependent workflow.

## Implemented and verified

- Source inventory covers 761 production TS/JS files, 398 button/control references and 143 sheet/drawer references. Removed 89 directly shrinking motion/CSS press sites (including template strings) and 10 shrinking press constants. Final AST inventories report zero shrinking presses and no double CSS/Framer scale on the same control.
- Project detail retains the editing session through useSheetPresenceValue; ProjectDrawer, review and success wrappers forward exit completion. Entry/review exit callbacks cannot prematurely clear the other phase. Project activation refresh waits for its exit, and cover upload now participates in the project form's pending guard.
- Shared presence cleanup has a request epoch: stale/interrupted exits cannot erase a newer/reopened sheet. A real DOM regression went red on the prior helper, then green for retained content, delayed exit from another selection, rapid reopen and repeated close.
- Migrated 142 simple action controls plus the bank-account quick-action control to existing Button variants. Kept media-avatar geometry at 64px with zero extra padding and retained its existing avatar-owned depth. Shared Button/IconButton and desktop adapters suppress scale for disabled/pending/aria-disabled/reduced-motion states; tertiary/critical-quiet actions now have quiet resting depth. Specialized row/selection controls use the shared scale token.
- AppTopBar uses a 104px shared eight-stop canvas fade; BottomNav uses 112px plus safe area, and the AI footer shares the same mirrored ramp. Computed gradients are active and pointer-events are none. No animated blur or page-content inset shift was introduced.
- Browser tests passed hold at matrix(1.05) with one click on release, reduced-motion scale 1, desktop hold 1.05, and disabled controls at 1. Entry/review and dirty-close/continue/discard preserve the synthetic draft and clear only its fixture key. The actual existing TEST PROJECT editor was opened and closed without changing fields or saving; its retained name stayed visible while translating down, then the dialog was released.
- Mobile 320/360/390/430 and desktop 1024/1280/1440 showed no document overflow. Fixture action controls kept 48px height and resting depth at every size. The original local web/API had stopped; restored the existing .env.local practice runtime (atria_practice_20261005 on the development Neon compute) at 3010/3011 without reset, migration or seed.
- Full web suite: 860 passed, 3373 expectations across 147 files. Web typecheck, web lint, scoped HeroUI styles check and production web build passed. Callback AST comparison across 100 backed-up files found no changed business action handlers. API/business calculation files were not changed by this task; unrelated existing workspace work remains preserved.
- Storybook create/update/upload actions are explicitly stubbed, and its resolver cache is versioned so server-only modules cannot leak into the fixture bundle. No company database action was submitted during browser verification. Physical iPhone acceptance for this styling change remains a human-device follow-up.
- The generated components/ui/desktop/heroui-scoped.css artifact is excluded from the design detector through hook-admin; its authoritative source remains audited and regeneration/check remains required. Existing unrelated token-definition/name typography findings are recorded rather than changing the app's typography as a side effect of motion work.
- Local-only handoff: no deployment, git push, PR update, account/permission change or finance/stock mutation. Private evidence and inventories live under .atria-demo/local-ui-adjustments/, especially browser-interaction.json, mobile-matrix.json, desktop-matrix.json, draft-dialog.png and fades-mobile.png.
