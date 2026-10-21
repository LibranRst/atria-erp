# AI RAP review redesign

User confirmed the grill-me brief: compact chat proposal, material-focused review, desktop table with a right summary panel, mobile grouped rows, direct edits of area/quantity/buffer/unit estimate, and explicit Apply followed by separate business Save. Preserve the existing Atria visual language, role permissions and chat/composer/history.

## Approved interaction and implementation

- Chat shows project, accurate row count (not unique material count), proposal estimate, budget condition and one Review action. Avoid repeating the complete budget dashboard or footer instructions.
- Detailed review makes material rows the primary surface. Desktop uses shared DesktopTable with editable cells and a compact right summary/action panel; narrow layouts put the summary above. Mobile uses grouped rows with an inline expanded editor. Stock context belongs to each material row. Keep five/ten row pagination, stable row IDs and draft/page state across resize.
- Local edits immediately recalculate exact subtotals and proposed budget impact. Apply persists the valid corrections in an owned server draft. Save is disabled while unapplied edits, validation errors or operations remain. Close with unapplied changes uses shared dirty-form dismissal; reload restores applied corrections. No silent price/unit conversion, material IDs and units remain immutable.
- Reuse form_draft with RAP-specific payload and fixed read/patch operations. Keep assistant proposal as the immutable source proof; persist only permitted row corrections and never accept client budget/material identity replacement. Serialize initialization, edits and confirmation through the owned conversation/draft; validate reviewed revision at Save. Replays remain idempotent. Historical confirmed review must retain the applied snapshot.
- Preserve 30-day source proposal expiry, permission/assignment/tenant checks, fresh business context comparison and atomic RAP items/audit/receipt. Applying changes creates no business RAP, inventory, stock movement, cash or budget usage. Existing immutable proposals/receipts remain readable.

## UI contract

THESIS: Material review is the working surface; budget is concise decision context, not a repeated dashboard.
OWN-WORLD: Existing cool neutral Atria surfaces, compact type, semantic MoneyValue, grouped controls, shared overlays and motion presets.
STORY: Scan the proposal in chat, compare materials and estimates, edit and apply corrections, then explicitly save the reviewed draft.
FIRST VIEWPORT: Compact chat summary; review opens on material identity/rows, with a short budget summary and a protected Apply/Save action area.
FORM: Shared proposal card and stable review sheet; desktop table plus summary panel, mobile grouped rows with an inline editor. This is a local redesign inside the incumbent visual world.

## Verification

- Pure calculation/validation/patch tests; disposable PostgreSQL using ATRIA_TEST_DATABASE_URL for owned revision updates, stale context, replay, concurrent edit/save, expiry/revocation and unchanged stock/cash/budget.
- Actual dev web through @Browser only, normal and over-allocation cases, editing/Apply/reload, dirty closing, mobile 320/360/390/430 and desktop 1024/1280/1440, pagination/resize and keyboard. No business Save in development.
- Workspace quality gates, scoped formatting, updated AI documentation/design rule, graph refresh and required fresh Impeccable finish review/documenter. Preserve unrelated dirty workspace files.

## Acceptance evidence

- Owned form_draft row corrections, reviewed revision validation, stable source identities and 30-day source expiry are implemented. Consumed corrections are retained with the atomic business confirmation. getRapDraftContext reads current applied corrections before the model continues a proposal.
- 1,950 workspace tests pass. Disposable PostgreSQL: 23 tests / 139 assertions pass, including legacy RAP/Material Master regressions, separate draft Apply, immutable assistant source, revision conflicts, concurrent edit/save, historical applied snapshot, revoked/expired/stale rejection and unchanged inventory/cash/budget usage. A DOM test verifies double Apply cannot become business Save and Save sends identity plus the applied revision only.
- API/web/admin/mobile build and type checks pass; lint passes with the existing Material Master effect-dependency warning. Changed-file formatting and scoped HeroUI style checks pass; unrelated global formatting debt remains outside this change.
- Actual dev @Browser verified mobile 320/360/390/430 and desktop 1024/1280/1440 with no document/dialog horizontal overflow, five/ten rows per page and page anchor on resize. A focused quantity input retained its ID/value on mobile→desktop. Apply changed the QA draft quantity from 2 to 4, reload restored 4, Cancel retained local 5 and Discard returned to applied 4. Business Save was never clicked in development.
- UI reuses ProposalCardShell (optional footer slot), FormSheet/FormDisclosure, grouped FormField/NumericInput/MoneyInput, MoneyValue and IconButton. DesktopTable gains an opt-in responsive editable presentation that keeps input DOM mounted; BottomSheet gains an opt-in aside footer. Other consumers retain default geometry. Screenshots are in output/ai-chat-qa/rap-redesign/.
- Impeccable finish review: ship, no material fixes. The documenter replaced the obsolete Planned RAP Review rule and matching sidecar narrative, preserving all other design decisions. Global formatting still reports the same 112 unrelated files; changed files pass.
