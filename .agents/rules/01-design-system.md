# Rule: Calm Modern Luxury Design System & iOS Contextual Forms

This rule governs all UI/UX styling, layout, typography, components, and interaction patterns in **Atria ERP**.

## 1. Core Visual Grammar & Mobile Truth
- **Viewport Truth**: Mobile screens (320px – 430px) are the primary source of truth. The application runs in a fixed `max-w-md` shell centered on desktop viewports. A desktop preview alone is never sufficient acceptance evidence.
- **Surface Hierarchy**: Use the semantic surface, container, ring, focus-ring, and shadow tokens defined in `DESIGN.md` and `app/globals.css`; do not introduce raw color, ring, or shadow utilities.
  - Background canvas: the semantic surface-container-low role.
  - Main cards & grouped forms: the semantic surface role with the documented soft radius.
  - Inset neutral cells: the semantic surface-container role.
- **Typography**: Manrope font with explicit tracking and line-heights:
  - Numbers & Financials: tabular numerals (`tabular-nums font-mono` or `MoneyValue`).
  - Section headers: concise, uppercase labels using the documented label typography token.
- **Semantic Palette**:
- **Semantic Palette**: Use the documented ink-primary, terracotta-accent, terracotta-critical, neutral surface, outline, accent-container, and critical-container roles. Do not hardcode their raw values in UI source.

---

## 2. iOS-Inspired Contextual Form Style (Paten)

### A. Standalone Controls (Outside Grouped Forms)
- **Inputs & Selectors**: Use the documented white fully rounded capsule, `min-h-12` (48px height), `px-5` horizontal padding, and semantic control/focus tokens.
- **Textareas**: Standalone textareas use `rounded-2xl` with `p-4`.
- **Buttons**: All buttons, option capsules, and segmented tabs use `rounded-full` (`rounded-capsule`).

### B. Grouped Forms (`FormSection`)
- Render controls as borderless rows on one shared white surface (`bg-white rounded-[24px]` or `rounded-[28px]`).
- Use thin subtle dividers (`border-b border-black/[0.04]`) between rows.
- Labels stay clearly visible in column or aligned row.
- **Do not nest a capsule inside grouped rows**; the grouped surface itself provides the container.

### C. Bottom Drawers & Sheets
- Outer canvas: the semantic surface-container-low role with the documented overlay treatment.
- Top radius: large soft rounded corners `rounded-t-[28px]`.
- Always include an iOS pull bar (`w-10 h-1 bg-black/20 rounded-full mx-auto my-2`).

### D. Selection & Search Dialogs
- Ordinary non-search selection uses `AdaptiveSelect`'s anchored listbox, including contextual/grouped rows. Use `SelectionDialog` only for an explicit protected-context override and `SearchDialog` only when search/create/custom behavior is required.
- Choice presentation uses the live component's soft scrim, `shadow-raised surface-container-low` canvas/header, and compact inset white option group; no blur or glass.
- Choice rows share one grouped white surface with consistent dividers; do not add another nested owner card.
- Selected rows keep the same white surface and use terracotta label + check; do not add a rectangular selected fill.
- `SelectionDialog` stays one calm plane with the standard compact close control in its header.
- `SearchDialog` uses a detached floating utility row: search capsule plus close circle above the edge-to-edge results plane.
- The visible white `DialogOptionList` surface owns measured height animation and remains mounted across query changes; never key it by query or use layout scale that stretches option rows.

---

## 3. Financial Display with `MoneyValue`
- Always import and use `MoneyValue` from the `@/components/ui` barrel.
- Primary amounts: bold, prominent, compact if necessary (e.g. `Rp 15.000.000`), never wrapped onto two lines.
- Secondary/exact amounts: tabular and clearly distinct.
- Negative values/deficits: display clearly with minus sign and critical terracotta styling if over budget.

---

## 4. Unified Motion Tokens (`lib/utils/motion.ts`)
Always use Framer Motion with standard tokens from `lib/utils/motion.ts`:
- **Drawers & Sheets sliding up**: `slideUpDrawerVariants` with `transitionSpringSmooth` (`type: "spring", stiffness: 300, damping: 32`).
- **Backdrops & Fades**: `fadeVariants` with `transitionEaseSmooth` (`type: "tween", ease: [0.32, 0.94, 0.6, 1], duration: 0.35`).
- **Micro-interactions (Tap / Hover)**: `transitionSpringSnappy` (`type: "spring", stiffness: 380, damping: 30, mass: 0.8`) e.g. `whileTap={{ scale: 0.97 }}`.
- **Celebratory / Success**: `transitionSpringBouncy` (`type: "spring", stiffness: 300, damping: 26`).

---

## 5. Forbidden Clichés & Anti-Patterns
- NO purple/violet accents on dark theme.
- NO arbitrary colored vertical severity rails on normal rows.
- NO excessive gradients, glassmorphism, or nested cards (3+ levels deep).
- NO raw unformatted enums or snake_case in UI (use `formatBusinessLabel`).
- NO decorative charts that do not serve an immediate financial or material decision.
