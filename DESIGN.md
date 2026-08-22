---
name: Atria ERP
description: Calm, terracotta-accented iOS-inspired mobile finance/material control system
colors:
  ink-primary: "#181817"
  terracotta-accent: "#b84b2c"
  terracotta-critical: "#97371f"
  ios-canvas: "#f5f5f7"
  surface-white: "#ffffff"
  inset-gray: "#efeff2"
  neutral-gray: "#636366"
  outline-gray: "#8e8e93"
  accent-container: "#f6e8e3"
  critical-container: "#f4e3dd"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "34px"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "29px"
  title:
    fontFamily: "Manrope, ui-sans-serif, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Manrope, ui-sans-serif, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "19px"
  label:
    fontFamily: "Manrope, ui-sans-serif, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: "12px"
    letterSpacing: "0.12em"
rounded:
  capsule: "9999px"
  owner: "28px"
  inset: "20px"
  icon: "16px"
spacing:
  base: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  margin-mobile: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.capsule}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.capsule}"
    padding: "0 20px"
    height: "48px"
  button-critical:
    backgroundColor: "{colors.terracotta-critical}"
    textColor: "#ffffff"
    rounded: "{rounded.capsule}"
    padding: "0 20px"
    height: "48px"
  input-standalone:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.capsule}"
    padding: "0 20px"
    height: "48px"
  card-grouped:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.owner}"
    padding: "0"
  badge-status:
    backgroundColor: "{colors.inset-gray}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.capsule}"
    padding: "0 10px"
    height: "24px"
  segmented-tabs-track:
    backgroundColor: "{colors.inset-gray}"
    rounded: "{rounded.capsule}"
    padding: "4px"
    height: "48px"
  segmented-tabs-active:
    backgroundColor: "{colors.ink-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.capsule}"
---

# Design System: Atria ERP

## Overview

**Creative North Star: "The Quiet Command Center"**

Atria looks like a calm surface hiding real operational power underneath. Every screen — Owner dashboard, expense tracker, stock movement, reconciliation — carries genuine financial and material control (budgets, margin risk, cash ledger, over-budget approvals), but presents it the way modern iOS presents a bank balance: flat tonal layering, one confident dark surface for the number that matters, quiet grouped rows for everything else, and a single restrained terracotta accent reserved for what actually needs attention. Nothing shouts. A project team member checking material readiness one-handed at a job site, and an Owner scanning margin risk in 30 seconds from a phone, should both feel the same unhurried confidence — competence expressed through restraint, not decoration.

This is deliberately not a generic SaaS admin dashboard and not a dense accounting spreadsheet. It borrows iOS's clear grouping, confident typography, and disciplined motion, not its glass, gradients, or oversized chrome. The system draws its entire color vocabulary from a monochrome ink-and-canvas foundation plus exactly one accent family (terracotta), so status and priority read through intensity and position, never through a rainbow of category colors.

**Key Characteristics:**

- Solid tonal layering (canvas → white owner surface → inset gray) doing the structural work, finished with a barely-perceptible resting lift on owning surfaces — never glass or heavy elevation
- One monochrome ink primary, one terracotta accent family covering both focus and warning/critical
- Compact but never cramped: hierarchy carries density, not shrunken type
- Fully capsule-shaped controls (buttons, tabs, badges, inputs) contrasted with 28/20/16px-radius container surfaces
- Motion is restrained and purposeful — spring-based, never decorative or continuous

## Colors

The palette is a disciplined cool-neutral monochrome foundation with exactly one warm accent family; there is no secondary or tertiary hue — priority is expressed through the accent's intensity and through position, not through additional hues.

### Primary

- **Ink Primary** (`#181817`): the one dark neutral used for primary commit buttons, the focal financial surface, primary text, and the active state of segmented tabs/bottom nav. It is the highest-contrast element in the system; as a focal surface it takes the dark-tier resting lift (`shadow-inverse`), whose rim is dimmed to 12% so it reads as a highlight rather than a glare line.

### Accent (the system's only hue family)

- **Terracotta Accent** (`#b84b2c`): focus rings, meaningful selection, and warning-intensity status. Used sparingly — reserved for conditions that genuinely change priority, never as decoration.
- **Terracotta Critical** (`#97371f`): the same family at higher intensity, for critical/error status and irreversible-action confirmation. Intensity distinguishes urgency; hue never changes.
- **Accent Container** (`#f6e8e3`) / **Critical Container** (`#f4e3dd`): the accent's tint containers, used behind warning/critical badges and containers, never as a large background fill.

### Neutral

- **iOS Canvas** (`#f5f5f7`): the app's background, behind every owning surface.
- **Surface White** (`#ffffff`): every owning/grouped/decision/identity surface — cards, sheets, nav pill, headers.
- **Inset Gray** (`#efeff2`): nested inset surfaces (metric grids, segmented-tab tracks, bottom-sheet canvas) that sit one layer inside a white owner.
- **Neutral Gray** (`#636366`): secondary text, muted labels, non-primary icon tone.
- **Outline Gray** (`#8e8e93`): borders and dividers at their most visible; most boundaries use a lighter derivative of this at very low opacity instead.

### Named Rules

**The One Accent Rule.** Terracotta is the only hue in the system. Warning and critical are the same family at different intensity, not different colors. Healthy, completed, pending, and inactive states stay neutral ink/gray with icon and copy carrying the meaning — never assign a fourth or fifth "status color."

**The No-Warm-Neutral Rule.** Neutral surfaces never take on cream, beige, brown, red, or yellow undertones. A neutral is always drawn from the cool ink/gray/canvas family above, never approximated with a warm gray utility because it "looks close."

## Typography

**Body & Display Font:** Manrope (with `ui-sans-serif, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, monospace` fallback), reserved for exact secondary financial amounts and dense reference detail

**Character:** Confident and compact — a semantic type scale where every named role carries its own line-height, so no call site picks a size and a leading independently. Manrope carries essentially all interface weight; JetBrains Mono only appears for a secondary exact amount beside a primary Manrope value, never for a primary number.

### Hierarchy

- **Display** (weight 800, 30/34px, `-0.02em`): the one justified focal financial value on a surface — used once per page at most.
- **Headline** (weight 700, 24/29px): page title.
- **Title** (weight 700, 17/22px, `-0.015em`): section title.
- **Body** (weight 600, 14/19px): row title or primary row value.
- **Label** (weight 700, 9/12px, `0.12em` tracking, uppercase): eyebrow metadata, dense labels, and uppercase field labels.
- Two intermediate roles exist between Body and Label that a component may need directly: **Support** (12/17px) for supporting context, and **Meta** (10/15px) for dense metadata and inset-metric-cell labels.

### Named Rules

**The Tabular Money Rule.** Every monetary value uses tabular numerals (`font-variant-numeric: tabular-nums`) so digits never shift width as they change. Primary values stay on one line at 320–430px; when a full amount is too long, show a compact primary value with an exact secondary value alongside, never a wrapped primary.

**The One Role Rule.** Pick the semantic type role whose purpose matches, not the one whose pixel size happens to look close. An arbitrary size remains valid only for something with no role in this table.

## Layout

The application shell is a single fixed `max-w-md` (448px) column at every viewport, from a 320px handset to a desktop browser window — there is no responsive breakpoint that introduces a wider desktop composition inside the shell. Design and verification both happen at 320, 360, 390, and 430px; a desktop preview alone is not acceptance evidence.

Vertical rhythm: roughly 20px between major sections (`spacing.margin-mobile`/`lg`), 8–12px within a section (`spacing.xs`/`sm`). Space increases only to express a real hierarchy change, not for decoration. The fixed header sits at 56px height; main content clears it with top padding and clears the bottom navigation/FAB with a safe-area-aware bottom padding.

Horizontal scrolling is reserved for tab/filter strips (which may auto-center their active item) and never applies to the page itself — a tab or filter change must not move the document's vertical scroll position. `SegmentedTabs` is the shared primitive for peer views/filters; swap its content instantly (no fade/slide/remount) and preserve URL query state when a tab should be shareable or restorable.

### Surface Grammar

Choose the owning surface before styling its contents. **Focal surface** — one strong summary or independent decision unit; the one dark financial surface is the canonical example. **Grouped surface** — one white container holding related rows with soft `divide-y` dividers; this is the default for activity, history, transactions, and master-data rows. **Inset metric grid** — two or three compact neutral cells nested inside a focal/grouped/decision surface, used only when the values must be scanned together (e.g. receivables/payables/near-term exposure, actual vs. budget, consumed vs. remaining); never for a single title/meta/value row, activity/history, or four-plus facts — promote one value or move detail into a sheet instead of shrinking type. **Decision item** — one independently actionable card or row with identity before metrics, at most one inset metric grid, and at most one full-width comparison below it. **Identity surface** — a branded/user-configured entity such as a bank account; configured gradients live here only.

Every row representing one identifiable activity/history/transaction event opens a contextual detail surface on tap; the whole row is the 48px touch target with a chevron, keyboard focus, and a screen-reader label. Aggregate summaries and master-data rows are not activity events and must not imitate this affordance.

Settings and Profile/identity workspaces keep one fixed page title with the active module title inside the content, summarize defaults as a relationship or posture rather than a KPI grid, and show related data as grouped rows with detail/edit actions in a sheet — never a second operational dashboard.

## Elevation & Depth

Every surface that **owns** something — a grouped card, a decision item, a capsule control, a status badge, the dark focal financial surface — sits gently lifted off the canvas. The lift is a top rim-light plus a tight, low-blur drop shadow: barely perceptible on any single element in isolation, but collectively it gives the app a tactile, native feel rather than a flat web-app look. Depth is still carried mostly by solid tonal layering (canvas → white → inset gray) and a barely-visible 1px ring; the lift is the finishing layer on top of that, never a replacement for it.

Two intensity tiers exist because the rim is a **white inset**. On a light surface it must be strong to register at all — and on a pure `#ffffff` card it is simply invisible, so the drop shadow alone does the lifting there; the rim only becomes visible on translucent (`bg-white/88`), inset-gray, and dark surfaces. On a near-black surface that same strength would read as a glare line instead of a highlight, so dark surfaces use a much dimmer rim.

What stays **flat**: anything nested inside an owner, or deliberately recessed. Inset metric cells, `DuotoneIconTile`, `MetricPill`/`MoneyMetricPill`, grouped form rows (borderless by design inside a lifted panel), and segmented-tab tracks. A recessed inset-gray track must never cast a lift — only the pill riding inside it does. Nesting a lift inside a lift produces mud, not depth.

Beyond the resting lift, functional elevation still exists for a small, fixed set of genuinely floating chrome: bottom sheets, dropdown/context menus, the floating bottom navigation bar, and the raised FAB (which shares the same horizontal center line as the tab bar — both sit in one `items-center` flex row with zero vertical offset at 320/390/430px).

### Shadow Vocabulary

Resting lift — light tier (`inset 0 1px 0 0 rgb(255 255 255 / 0.65), 0 1px 1px rgb(24 24 23 / 0.03), 0 3px 8px rgb(24 24 23 / 0.05)`):

- **Surface**: grouped/owning cards, decision items, panel sections.
- **Control**: capsule and circular controls — buttons, badges, search bars, standalone inputs, header icon buttons, avatar.

Resting lift — dark tier (`inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 1px 1px rgb(24 24 23 / 0.1), 0 3px 8px rgb(24 24 23 / 0.14)`):

- **Primary**: ink-primary commit buttons and the active segmented-tab/nav pill.
- **Inverse**: the dark focal financial surface.

Floating chrome:

- **Raised** (`inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 10px 28px rgb(24 24 23 / 0.09)`): menus, floating nav chrome, sticky action bars, tooltips.
- **Floating** (`inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 14px 34px rgb(24 24 23 / 0.18)`): the FAB's resting elevation. Reserved for what genuinely floats — never for a static dark card, which takes `inverse`.
- **Sheet** (`box-shadow: 0 -24px 80px rgb(0 0 0 / 0.28)`): bottom sheets rising off the page.
- **Overlay** (`box-shadow: 0 28px 90px rgb(0 0 0 / 0.32)`): centered modal/media overlays.

### Ring and Elevation Utilities

The only source of shadow geometry and ring color is `app/globals.css`; UI source uses these semantic roles, never a raw `shadow-[...]`, `box-shadow`, or `ring-black/*`:

| Utility                             | Contract                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ring-ring-subtle`                  | Barely-visible edge for white owning surfaces — tone does the separating work                          |
| `ring-ring-control`                 | Inputs, selectors, or floating control chrome needing a clearer edge                                   |
| `ring-focus-ring`                   | Default keyboard/input focus ring on light surfaces                                                    |
| `ring-focus-ring-strong`            | Gradient, media, or inverse surfaces where the default focus ring lacks contrast                       |
| `shadow-surface`                    | Owning cards, grouped surfaces, panel sections (light tier)                                            |
| `shadow-control`                    | Capsule/circular controls: buttons, badges, search bars, standalone inputs, header chrome (light tier) |
| `shadow-primary`                    | Ink-primary commit buttons and the active nav/tab pill (dark tier)                                     |
| `shadow-inverse`                    | The dark focal financial surface (dark tier)                                                           |
| `shadow-raised` / `shadow-floating` | Menus, floating navigation chrome, and the FAB (see Shadow Vocabulary)                                 |
| `shadow-sheet` / `shadow-overlay`   | Bottom sheets and centered modal/media overlays (see Shadow Vocabulary)                                |

Pick the role by **what the element is**, not by how heavy you want the shadow — the tier is already encoded in the role. A ring and a lift are complementary and are meant to coexist on an owning surface; what you never do is stack two shadow roles on one element. Focus visibility always uses a `focus-ring` role, including on destructive controls — status color communicates status, never keyboard focus.

### Named Rules

**The Nested-Stays-Flat Rule.** A surface that sits inside another owner, or that is deliberately recessed, carries no lift: inset metric cells, icon tiles, metric pills, grouped form rows, and segmented-tab tracks. Elevation marks what owns hierarchy, so applying it to a nested element destroys the signal.

**The Lift-Is-Not-Loud Rule.** The resting lift must stay imperceptible element-by-element. If a shadow is legible on its own, it belongs to floating chrome (`raised`/`floating`/`sheet`/`overlay`), not to a resting surface — and if a static card reaches for `shadow-floating`, the role is wrong, not the value.

## Shapes

Two distinct form languages coexist on purpose. **Standalone interactive controls** — buttons, tabs, badges, inputs, selectors, toggles, option cards — are always a full capsule (`rounded-full`/`9999px`); this is what tells a user "this is directly tappable." **Owning and inset container surfaces** use a fixed three-step radius scale instead: 28px for anything that owns hierarchy (focal, grouped, decision, and identity surfaces, plus bottom-sheet top corners), 20px for a surface nested one layer inside an owner (inset metric cells, sheet sections), and 16px for icon tiles. A container is never given a capsule radius, and a standalone control is never given the 28/20/16 scale — the two vocabularies don't mix.

## Components

### Buttons

- **Shape:** full capsule (`rounded-full`), 48px minimum height, `min-h-12 px-5`.
- **Primary:** ink-primary background, white text, bold weight — one per surface or sheet, the only obvious commit action.
- **Secondary:** white background with a 1px control-boundary ring, ink-primary text — a visible supporting action.
- **Tertiary:** neutral text only, no fill — drill-down/view-all/reversible navigation.
- **Critical Quiet / Critical:** critical-container tint for opening a destructive flow; solid terracotta-critical fill only after explicit confirmation.
- **Tap feedback:** `whileTap: scale(0.97)` with the snappy spring (`stiffness 380, damping 30, mass 0.8`); disabled state drops to 45% opacity.

### Badges (Status, Count, Section)

- **Status badge:** 24px capsule, uppercase 9px bold label, a status dot only for pending/warning/critical tones. Tone vocabulary is exactly `healthy · warning · critical · pending · completed · neutral · inactive` — never a raw enum or extra hue.
- **Count badge:** compact same-surface numeral counter (caps display at "99+"), tinted only when the count is itself an attention signal.
- **Section count pill:** a neutral capsule naming the item type with a nested count badge, used only for a cardinal workload total in a section header — never for status, dates, or ratios.
- **Metadata chip:** a compact neutral chip for descriptive context that plain text can't carry cleanly; use sparingly, never for status.

### Cards / Containers

- **Corner style:** 28px (owner) for grouped surfaces, decision items, identity cards, and panel sections; 20px for anything nested inside one.
- **Background:** white for every owner; inset gray only for what's nested inside it.
- **Shadow:** `shadow-surface` — the resting lift every owning card carries; anything nested inside stays flat. See Elevation & Depth.
- **Border:** a barely-visible 1px `ring-ring-subtle` boundary; tone does the separating work, not the ring.
- **Internal structure:** repeated simple rows share one owner with soft `divide-y` hairline dividers between them; only a genuinely independent, decision-heavy entity gets its own separate card.

### Inputs / Fields

- **Standalone style:** white full-capsule control, `min-h-12`, `px-5`, a hairline `outline-variant/35` border.
- **Focus:** border shifts to the terracotta accent and a 2px `focus-ring` halo appears — focus color is always the accent, independent of any status color nearby.
- **Grouped (inside a form panel):** the capsule disappears — fields become borderless rows inside one white panel, separated by hairline dividers, with the label sitting above/beside the value instead of inside a bordered box.
- **Error:** restrained inline error-tinted text directly under the field; no separate error card.
- **Grouped panel:** `FormSection` owns one white 24–28px surface; its controls become borderless, labeled rows with subtle dividers — never a capsule nested inside another owner.
- **Textareas:** `rounded-2xl` when standalone; an unboxed growing row when inside a grouped form.

### Forms & Sheets

- **Sheet scope is narrow:** consumer code uses `FormSheet` only for three or more related fields or a compact form promoted by substantial impact/review context; `DetailSheet` owns contextual/read-only detail that needs room or scroll. Raw `BottomSheet` is internal UI implementation and never a feature-level choice.
- **Entry vs. review:** `OperationalFormSheet` is for focused data entry with a stable header and action/status footer; `WorkflowFormSheet` is for a review/confirm/commit step. Both sit on `FormSheet` chrome: `surface-container-low` canvas, white grouped content, `rounded-t-[28px]` top corners, a pull indicator, and safe-area-aware footer spacing. Fixed header/footer chrome uses a token-based edge scrim over one scroll plane, never a hard opaque cutoff.
- **Footer actions:** `SheetFooterActions` orders status/reason copy above its buttons. A single primary action is full-width; a safe secondary action sits beside it in two equal 48px capsule columns. The sheet header is close/navigation only — it never submits or commits.
- **Compact dialogs:** one or two compact fields use `CompactFormDialog`; a calendar uses `CalendarDialog`; operation results use `SuccessDialog`; irreversible choices use `ConfirmationDialog`. These share one internal `DialogFrame` for focus, visual viewport, keyboard avoidance, body lock, portal/layering, and dismissal. Deprecated names ending in `Modal`/`Sheet` are compatibility aliases only.
- **Success:** `SuccessDialog` stays visible until an explicit action, carries at most four facts, and promotes any longer result to a detail surface instead of becoming a scrolling report.
- **Presence:** preserve presented data until an overlay's exit animation completes so a closing sheet never flashes empty content; keep focus trapping, focus restoration, body-scroll locking, Escape handling, and the established z-index/portal hierarchy intact — never stack a new local z-index above it.
- **Motion:** drawers/sheets slide from their spatial origin; dialogs use only a subtle scale plus opacity; backdrops fade opacity only. Every transition comes from `lib/utils/motion.ts` and reduced motion removes scale/slide.

### Contextual Menus, Selects & Help

- **Weight follows the task:** `ActionMenu` and simple `AdaptiveSelect` choices stay anchored to their trigger. Contextual options use `SelectionDialog`; more than six options, custom values, and comboboxes use top-biased `SearchDialog`; dates use `CalendarDialog`. None of these fall back to a sheet or fullscreen surface.
- **Adaptive select rule:** one through six label-only options use an anchored listbox; three through six contextual options use a selection dialog without search; more than six options or create/custom actions use search. Canonical overrides are `presentation="menu" | "dialog"`; deprecated `"sheet"` maps to dialog for one compatibility cycle.
- **Filter visibility:** two through four high-frequency peer filters stay visible as pills. Two secondary filters live in an `AnchoredFilterPanel`; Reset/Terapkan operate on a local draft, while outside press or Escape discards it.
- **Anchored geometry:** menus and popovers have no scrim or body lock. They sit 8px from the trigger, keep a 12px viewport gutter, flip/shift around collisions, and scroll internally when height is constrained. A select inside a sheet inherits a layer immediately above that sheet; no feature defines its own z-index.
- **Semantics:** action commands use `menu/menuitem`; selection uses `listbox/option`; light disclosure uses a non-modal dialog; protected compact/search/calendar/confirmation surfaces use modal `dialog`/`alertdialog`. Arrow keys, Home/End, typeahead, Escape, outside press, selected state, and focus restoration belong to shared modules.
- **Tooltip restraint:** every `IconButton` exposes its required label as a tooltip on mouse hover or keyboard focus. Touch activation is never intercepted. Tooltips explain only non-critical controls or terms, stay non-interactive, close with Escape, and may never be the sole carrier of required information.
- **Motion:** anchored surfaces scale subtly from their placement origin while fading with `transitionSpringSnappy`; tooltips fade only. Reduced motion removes scale and uses an immediate opacity state.

### Icons

- Every user-facing icon renders through the shared typed `AppIcon` mapping backed by Phosphor Icons — never Material Symbols, an icon font, or raw glyph text. `AppIcon` is a `1em` SVG, so its size tracks `font-size`; use the dedicated `icon-xs`…`icon-2xl` utilities to size it independently of type.
- `DuotoneIconTile` (~36–40px, 16px icon radius) is the shared tactile identity tile for summaries, categories, priorities, and repeated-row identity. Its normal treatment is neutral; terracotta is reserved for genuine urgency. Never pair it with a decorative marker or severity rail — status is icon treatment + copy + tone + position; a continuous vertical connector is valid only for a real timeline relationship.
- Icon-only controls stay accessible through `IconButton`'s required label; an icon beside a visible label is decorative and needs no separate label.

### Navigation

- **Bottom tab bar:** a floating white capsule (`rounded-full`) with `raised` elevation, containing a sliding ink-primary active-tab pill (`transitionSpringBouncy`: `stiffness 300, damping 26`) behind flat icon buttons; active icons switch to filled weight.
- **FAB:** a circular ink-primary capsule with `floating` elevation that morphs into a rounded-rectangle (28px corners) quick-action menu on open, expanding height/width via spring rather than a separate overlay component; it shares the same center line as the bottom tab bar (0px vertical delta at 320/390/430px), not an offset above it.
- **Segmented tabs (`SegmentedTabs`):** an inset-gray capsule track holding a sliding ink-primary active pill (same bouncy spring); labels stay short, counts sit inside the pill as a same-surface numeral, and horizontal overflow scrolls and re-centers without ever moving the page. Tab/filter content itself swaps instantly — no fade, slide, or remount.
- **Header:** a fixed 56px bar with circular white icon buttons (back/chat) on the left and a circular avatar on the right; a title/menu control occupies the center and can morph into an expanded menu.

### Financial Values

- Every monetary display uses the shared `MoneyValue` component with tabular numerals; a compact primary value pairs with an exact secondary value when the full amount would be too long to keep on one line at 320–430px.
- A comparison (budget vs. actual, target vs. projection, available cash vs. near-term obligations) must answer a real question; percentage-based indicators always expose the underlying nominal used/remaining values alongside the geometry, and geometry may clamp visually at 0–100% but the real number stays visible.
- Choose the indicator by question, not by habit: a split indicator for used vs. remaining, a threshold rail when 80%/100% boundaries matter, a block meter for discrete category health, before/after values for approval impact, a timeline for due dates, or plain labeled values when a visual adds nothing. Never repeat the same progress treatment under every metric, and never add a chart unless trend/distribution/time-series comparison materially improves a decision.

## Do's and Don'ts

### Do:

- **Do** keep exactly one accent hue (terracotta) system-wide; express urgency through its intensity (`#b84b2c` → `#97371f`), never through a new hue.
- **Do** give every owning surface and standalone control its semantic resting lift (`shadow-surface`/`shadow-control`, or the dark-tier `shadow-primary`/`shadow-inverse`), and keep everything nested inside one flat.
- **Do** keep every standalone interactive control a full capsule, and every container surface on the fixed 28/20/16px radius scale — never mix the two vocabularies.
- **Do** keep primary monetary values on one line with tabular numerals at 320–430px, falling back to a compact value + exact secondary value when the full amount is too long.
- **Do** combine status with copy and an icon/shape/position — never color alone.
- **Do** keep motion purposeful and spring-based (`lib/utils/motion.ts` presets only) — selection, origin, continuity, feedback.
- **Do** put simple repeated events, transactions, and master-data rows on one grouped surface with dividers; reserve an individual card for a genuinely independent, decision-heavy entity.
- **Do** keep every main route's `loading.tsx` a structural skeleton matching the final hierarchy (header/tabs, focal summary, expected rows, nav clearance) — never a centered spinner or generic loading card.
- **Do** keep effective touch targets at 48×48px even when a visible control is drawn smaller (32–40px), and preserve keyboard focus order, screen-reader labels, safe-area clearance, and reduced-motion behavior throughout.

### Don't:

- **Don't** add a second or third accent color, a rainbow of category colors, or a locally-defined focus-ring color.
- **Don't** hand-roll a shadow value or reach past the semantic role — no `shadow-[...]`, no raw `box-shadow`, and no `shadow-floating` on a static card. Never put a lift on a nested row, icon tile, metric cell, or recessed tab track, and never apply blur or glass to an ordinary surface.
- **Don't** use glassmorphism, decorative gradients, or oversized touch chrome anywhere except a configured bank-account identity surface (the sole user-defined gradient exception).
- **Don't** wrap a primary money value, or let a value's digits reflow without tabular numerals.
- **Don't** add whole-page transitions, section entrances, or list-stagger animation — routes, tabs, and lists stay visually instant; only the active-pill spring and explicit local feedback (taps, sheets, disclosures) animate.
- **Don't** warm a neutral surface with cream, beige, brown, red, or yellow undertones.
- **Don't** ship a generic admin-dashboard or spreadsheet-like composition — a repeated formula of summary card, header pill, and identical rounded cards for every section is a tell that the content pattern wasn't chosen deliberately.
- **Don't** use an inset metric grid for a single title/meta/value row, activity/history/transactions, or more than three equal-weight cells in one mobile row; don't give a metric cell its own shadow, elevation, or oversized radius that competes with its owning surface.
- **Don't** nest a capsule inside another owning surface for ordinary grouped rows, or place a colored vertical severity rail or short attention marker beside an ordinary list icon — a continuous connector is timeline-only.
- **Don't** leave a hidden action or an ambiguous icon-only control without an accessible label, or build UI from placeholder/dummy data when real domain data exists.
