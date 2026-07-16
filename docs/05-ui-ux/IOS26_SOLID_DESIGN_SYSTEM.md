# iOS-Inspired Solid Design System

For page composition, density, grouped rows, financial formatting, loading states, and visual QA, `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md` is the active source of truth. The rules below define the component and interaction layer used by that page language.

## Direction
The interface should feel premium, calm, modern, operational, and trustworthy. It should be inspired by modern iOS interaction patterns but remain solid and readable, not overly glassy or decorative.

## Principles
- Mobile-first.
- Clear hierarchy over visual noise.
- Purposeful focal and grouped surfaces with subtle shadows and soft rings.
- Large tap targets.
- Clean financial numbers with context labels.
- Status badges that are readable at a glance.
- Contextual comparisons and indicators that help decisions.

## Avoid
- Dense spreadsheet-like screens on mobile.
- Excessive gradients, glassmorphism, blur, or animation.
- Generic admin dashboard compositions.
- Repeating one card or progress-bar formula across unrelated content.
- Oversized type, padding, and controls that become cramped at 320–430 px.
- Client-facing screens that expose internal cost/margin data.

## Components
- One focal surface for a dominant summary when justified.
- Grouped surfaces and soft dividers for repeated rows.
- Individual cards only for independently interactive units.
- Segmented controls for dashboard/project tabs.
- Bottom sheets for quick stock/expense actions.
- Badges for RAP, stock, purchase, bill, and budget status.
- Split indicators, threshold rails, block meters, comparisons, or timelines according to context.
- Icon buttons with accessible labels for common actions.

## Reference UI

The current Dashboard and Expenses pages are the canonical implementation references:

- `features/finance-dashboard/components/`
- `features/expenses/components/`
- `components/ui/segmented-tabs.tsx`
- `components/ui/page-primitives.tsx`

Inspect these implementations before adding a new main page. Share primitives when semantics match, but keep each domain's content pattern functional rather than visually cloned.

## Material-Control Visual Language
- `READY`: stable/success treatment.
- `SHORTAGE` and `LOW_STOCK`: warning treatment.
- `CRITICAL`, `WASTE`, and overbudget states: error treatment.
- `WAITING_PURCHASE`: neutral or warning treatment depending on urgency.

## iOS-Inspired Contextual Form Style (Paten)
Interactive controls remain fully rounded when they stand alone. Grouped data-entry forms use native iOS row composition instead of nesting capsules:
- **Standalone Inputs & Selects**: Text inputs, DatePickers, Comboboxes, and Select fields use a white `rounded-full` control with `min-h-12` (48px) and `px-5`.
- **Grouped Forms**: `FormSection` owns one white panel with a 24–28px radius. Its fields are borderless rows with visible labels, compact 52–56px posture where content permits, and subtle internal dividers.
- **Textareas**: Standalone textareas use `rounded-2xl`; grouped textareas grow inside their row without a second container.
- **Field Layout**: Text, money, and notes are stacked. Toggles and short choices may opt into an inline label/control row. Helper and error copy stays inside the row.
- **Buttons**: All action buttons, toggles, selectors, and option cards must use fully rounded capsule shapes (`rounded-full`).
- **Drawers & Sheets**: Sliding sheets use a light gray canvas (`surface-container-low`), white grouped surfaces, large rounded top corners (`rounded-t-[28px]`), and circular header controls. Centered confirmations keep their geometry but share the same palette.
- **Focus & Selection**: Use iOS blue for focus, selected options, calendar dates, and checkmarks. Keep Atria black for primary submit and semantic colors for status.
- **Touch Targets**: Visible compact controls may be 32–40px high only when their effective interactive area remains at least 48x48px.
- **Content Surfaces**: Focal and grouped content use soft large radii; repeated rows use dividers and must not become nested capsules.

## Unified Motion & Animation Tokens
All animations must use Framer Motion and reference the unified animation presets in `lib/utils/motion.ts`:
- **Drawers & Sheets sliding up**: Use `slideUpDrawerVariants` with `transitionSpringSmooth` (`stiffness: 300, damping: 32`) for smooth sliding physics.
- **Backdrops & Fades**: Use `fadeVariants` with `transitionEaseSmooth` (`ease: [0.32, 0.94, 0.6, 1]`, `duration: 0.35`) for translucent fades.
- **Snappy Micro-interactions**: Use `transitionSpringSnappy` (`stiffness: 380, damping: 30, mass: 0.8`) with active tap scale effects (e.g. `whileTap={{ scale: 0.97 }}`).
- **Bouncy celebratory animations**: Use `transitionSpringBouncy` (`stiffness: 300, damping: 26`).
- Avoid custom inline spring configs or CSS keyframe animations.
- Respect reduced motion. Keep selection and spatial transitions, but do not animate whole sections or tab content without a functional reason.
