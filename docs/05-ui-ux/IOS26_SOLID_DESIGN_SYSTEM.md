# iOS-Inspired Solid Design System

## Direction
The interface should feel premium, calm, modern, operational, and trustworthy. It should be inspired by modern iOS interaction patterns but remain solid and readable, not overly glassy or decorative.

## Principles
- Mobile-first.
- Clear hierarchy over visual noise.
- Solid cards with subtle shadows and soft borders.
- Large tap targets.
- Clean financial numbers with context labels.
- Status badges that are readable at a glance.
- Minimal charts and progress indicators that help decisions.

## Avoid
- Dense spreadsheet-like screens on mobile.
- Excessive gradients, glassmorphism, blur, or animation.
- Generic admin dashboard compositions.
- Client-facing screens that expose internal cost/margin data.

## Components
- Cards for repeated items and compact summaries.
- Segmented controls for dashboard/project tabs.
- Bottom sheets for quick stock/expense actions.
- Badges for RAP, stock, purchase, bill, and budget status.
- Progress bars for budget usage and material readiness.
- Icon buttons with accessible labels for common actions.

## Material-Control Visual Language
- `READY`: stable/success treatment.
- `SHORTAGE` and `LOW_STOCK`: warning treatment.
- `CRITICAL`, `WASTE`, and overbudget states: error treatment.
- `WAITING_PURCHASE`: neutral or warning treatment depending on urgency.

## iOS-Inspired Fully Rounded UI Style (Paten)
We enforce a strict fully rounded iOS style for all interactive controls:
- **Inputs & Selects**: Text inputs, DatePickers, Comboboxes, and Select fields must be fully rounded (`rounded-full`) with a minimum height of `min-h-12` (48px) and side padding `px-5`.
- **Textareas**: Multiline inputs (Textarea) must use `rounded-2xl` (16px border-radius) for aesthetic balance and layout stability.
- **Buttons**: All action buttons, toggles, selectors, and option cards must use fully rounded capsule shapes (`rounded-full`).
- **Drawers & Sheets**: Sliding bottom sheets and confirmation dialogs must use large soft rounded top corners (`rounded-t-[28px]`) or cards (`rounded-[28px]`).

## Unified Motion & Animation Tokens
All animations must use Framer Motion and reference the unified animation presets in `lib/utils/motion.ts`:
- **Drawers & Sheets sliding up**: Use `slideUpDrawerVariants` with `transitionSpringSmooth` (`stiffness: 300, damping: 32`) for smooth sliding physics.
- **Backdrops & Fades**: Use `fadeVariants` with `transitionEaseSmooth` (`ease: [0.32, 0.94, 0.6, 1]`, `duration: 0.35`) for translucent fades.
- **Snappy Micro-interactions**: Use `transitionSpringSnappy` (`stiffness: 380, damping: 30, mass: 0.8`) with active tap scale effects (e.g. `whileTap={{ scale: 0.97 }}`).
- **Bouncy celebratory animations**: Use `transitionSpringBouncy` (`stiffness: 300, damping: 26`).
- Avoid custom inline spring configs or CSS keyframe animations.
