# RAP review: material-first review workspace

The user rejects the current composition after incremental polish and requests a complete redesign of every review section, especially mobile. Inherit Atria's established Operate visual system; replace the review's hierarchy and composition, preserving product truth and all draft/permission/calculation contracts.

- One project identity header gives the review context. Budget becomes a compact comparison of proposed cost and Material allocation, followed by a readable budget verdict. Secondary budget facts remain in a quiet disclosure, with planned RAP separated from actual/pending spending.
- Clearly label the material workspace. Mobile rows show material and area first, then subtotal and a concise quantity/price relationship, with stock context kept on the same row. A visible Edit action reveals one grouped editor; avoid competing subtotal/edit/name alignment.
- Desktop uses explicit Material, Area, Quantity, Buffer, Unit estimate and Subtotal columns. Reuse the shared stable responsive DesktopTable DOM; keep five/ten-row pagination and focused draft input across resize.
- Editing uses shared grouped FormField/TextInput/NumericInput/MoneyInput, quiet Manrope tabular values, 16px mobile floor, and visible sentence-case labels. Apply remains distinct from business Save, with stable action targets, current validation/conflict/expiry/confirmation states, and dirty dismissal.
- Footer tells the user what will be saved and places one contextual primary next action clearly. Unapplied corrections cannot be saved. No new stock/cash operations.
- Notes move into an optional secondary disclosure. Content-fit sheet geometry and semantic motion presets remain shared.

Verify dev @Browser mobile 320/360/390/430, intermediate 716, desktop 1024/1280/1440, normal twelve-row and over-allocation one-row proposals, editor/disclosure/pagination, keyboard/resize persistence and dirty dismissal. Do not save business RAP in dev. Run relevant types/tests/lint/style/format checks. Impeccable finish review and documentation handoffs, then graph refresh.

## Delivery and verification

Replaced every review section's composition while retaining Atria identity and business contracts. Shared `FormSheet`, `DesktopTable`, `FormSection`, `FormField`, `Textarea`, `NumericInput`, `MoneyInput`, `MoneyValue`, `Button` and `FormDisclosure` own the interactions. No new primitive was introduced. The table's opt-in review presentation now provides caret-key deferral and compact stable mobile editors; Area uses the public wrapping Textarea. Budget uses full-width desktop metric blocks and a mobile comparison grid. Project identity uses the existing17px `text-section` role. Notes are secondary; footer explains the next action and keeps Apply separate from Save.

Dev @Browser covered320/360/390/430/716/1024/1280/1440px at an844px phone-height viewport. Focus and value survived all eight widths; no document horizontal overflow. End stayed inside quantity and Area controls. The full long Area value at1024px had matching scroll/client height. Verified normal twelve-row and over-allocation one-row drafts, mobile five/desktop ten pagination, local calculations, disabled Save before Apply, Cancel retaining edits, discard protection, and expanded budget facts. Temporary QA edits were reverted; no business Save was clicked.

The shared sheet header scrim now covers the actual header height before its existing16px fade, preventing scrolled content from painting beneath its title. Geometry, scroll ownership, motion and footer offsets are unchanged. Existing global token/meta-size detector hints were checked against the incumbent design authority; no new color or font token was added.

Workspace tests passed (1,951); workspace build, final web production build/types, lint, style generation/check and scoped formatting passed. Lint retains the existing unrelated Material Master accept-dependency warning. Focused overlay keyboard, typography, table and RAP consent checks also passed. Impeccable fresh finish review closed with disposition: ship, all findings resolved. Evidence is under `output/ai-chat-qa/rap-composition/`. Durable composition is recorded in the app surface brief and reconciled with DESIGN.md/sidecar. Graph refreshed after documentation.
