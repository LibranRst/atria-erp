---
name: Atria Admin
description: Compact project finance administration using native HeroUI defaults.
colors:
  accent: "oklch(0.6204 0.195 253.83)"
  accent-foreground: "oklch(0.9911 0 0)"
  background: "oklch(0.9702 0 0)"
  foreground: "oklch(0.2103 0.0059 285.89)"
  surface: "oklch(100% 0 0)"
  surface-secondary: "oklch(0.9524 0.0013 286.37)"
  default: "oklch(94% 0.001 286.375)"
  muted: "oklch(0.5517 0.0138 285.94)"
  border: "oklch(90% 0.004 286.32)"
  success: "oklch(0.7329 0.1935 150.81)"
  warning: "oklch(0.7819 0.1585 72.33)"
  danger: "oklch(0.6532 0.2328 25.74)"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  field: "12px"
  panel: "12px"
  chip: "16px"
  button: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  control: "12px"
  md: "16px"
  panel: "20px"
  section: "24px"
  wide: "32px"
components:
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "32px"
  button-secondary-sm:
    backgroundColor: "{colors.default}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "32px"
  button-danger-sm:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "32px"
  input-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
  surface-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: Atria Admin

## Overview

**Creative North Star: "Compact Project Finance"**

Atria Admin is an Operate surface for desk work: compare project finances, inspect context, and explicitly review changes. Native HeroUI React and Styles (both pinned to 3.2.6) define its visual world. The app imports the complete HeroUI stylesheet into its own document and fixes the light theme; it adds no brand palette, font, radius override, or custom asset system.

This record applies to `apps/admin`. Root `PRODUCT.md` supplies product truth; the approved standalone plan supplies the phase boundary. The existing web/mobile and legacy desktop design rules have separate UI ownership. The implemented slice is the shell, account gates, and Proyek/Budget; later workflow parity and legacy removal remain acceptance work.

**Key Characteristics:**

- Native blue actions, white owning surfaces, neutral canvas, and semantic status colors.
- Compact system sans hierarchy and native `sm`/`md` control density.
- Project comparisons in tables; details and editing receive their own context.
- Explicit review, permission-aware actions, Indonesian feedback, and protected drafts.

## Colors

The palette is HeroUI's default light theme, preserved in its canonical OKLCH format. The frontmatter records the installed values; the runtime authority remains `@heroui/styles` default theme variables and their semantic aliases. Sidecar tonal ramps are panel previews, not additional application colors.

### Primary

- **Native blue** (`--accent`): primary actions and native focus treatment. HeroUI derives hover and soft variants from this token.
- **Light action text** (`--accent-foreground`): text on primary and danger buttons.

### Secondary

- **Success** (`--success`): active, approved, healthy, safe, and completed statuses.
- **Warning** (`--warning`): review pending, on hold, and attention/risk statuses.
- **Danger** (`--danger`): critical, over budget, cancelled, rejected, negative remaining amounts, and explicit discard actions.

### Neutral

- **Canvas** (`--background`): document background.
- **Ink** (`--foreground`): main text and financial values.
- **White surface** (`--surface`, also native field/overlay backgrounds): panels and controls.
- **Secondary surface** (`--surface-secondary`): table framing and headers.
- **Default neutral** (`--default`): secondary/tertiary buttons and native neutral states.
- **Muted text** (`--muted`): supporting copy, metadata, and table headings.
- **Border** (`--border`): shell boundaries and local dividers.

**The Native Theme Rule.** Use HeroUI semantic tokens and variants directly. Extend the local domain compositions without redefining the native palette or copying the web app's theme.

**The Status Has Words Rule.** Status uses a translated label inside a chip, or labelled alert content; semantic color reinforces that meaning.

## Typography

**Body Font:** the installed default `--font-sans` system stack. Headlines use the same family; there is no separate display or mono face. Emoji fallbacks follow the system stack in the stylesheet.

**Character:** compact and familiar. Weight, spacing, and financial alignment establish hierarchy without a branded display treatment.

### Hierarchy

- **Headline:** route titles; the strongest text role, with tight tracking.
- **Title:** section headings, project context headings, and summary amounts.
- **Body:** table cells, supporting copy, and ordinary operational content.
- **Label:** native buttons and labelled controls.
- **Meta:** table headings, metric labels, and secondary context.

Native fields use 16px text below 640px and 14px from 640px. Modal headings retain HeroUI's own default typography. Do not scale up the desktop type ramp to imitate the mobile product.

**The Tabular Money Rule.** Use the local `MoneyValue` for IDR presentation. It keeps amounts on one line with tabular numerals, uses shared core formatting, and exposes the exact amount as a title when a compact amount is displayed. Usage percentages also use tabular numerals.

## Layout

The shell uses a sticky, viewport-height sidebar (208px) from 768px and a bordered header with a minimum height (64px). The main canvas is centered with a maximum width (1600px), horizontal padding (20px, increasing to 32px at 1024px), and vertical padding (24px). The sidebar disappears at smaller widths; the header keeps the app identity and account menu.

Spacing follows the native quarter-rem rhythm. Repeated content uses 12–24px gaps and 20px panel padding. Headers and action groups wrap when space is limited. Forms use one column, becoming two at 640px when the content supports it.

The project table owns row comparison, search, filtering, sorting, and selection. Selecting a visible row adds a context panel (280px) beside it from 1280px; below that width the panel follows the table. Project and category tables retain content minimum widths (820px and 760px) inside the native scroll container. Small screens scroll tables horizontally while the document remains a usable single column; resize does not navigate or reset editors.

Budget editing is a full page. Its position summary groups financial metrics within one surface; the current implementation moves from one metric column to three at 640px and six at 1280px. Category usage remains a comparison table below it.

**The Context Before Action Rule.** Keep actions with the project or budget they affect, and show permission-appropriate review controls next to the relevant state.

## Elevation & Depth

The canvas, white panels, table framing, and dividers provide the page hierarchy. Local finance panels are flat; native fields use `--field-shadow`, and native dialogs/popovers use `--overlay-shadow`. HeroUI owns native component elevation, focus rings, pressed states, and animation. These defaults are part of this app's chosen world.

The global reduced-motion media query shortens animations/transitions and disables smooth scrolling; native HeroUI motion-reduction behavior remains in place. Local features add no independent motion system.

**The Native Interaction Rule.** Keep focus, overlay dismissal, pending feedback, and component transitions in HeroUI's interaction contract. Domain compositions supply behavior and data rather than replacement visual infrastructure.

## Shapes

Native fields and local finance panels use softly rounded corners. Buttons use HeroUI's native rounded geometry, which becomes capsule-like at compact heights; chips use native compact rounded shapes. The app does not impose the web/mobile product's fully rounded field rule or effective 48px control sizing.

Native `sm` buttons are 32px high from 768px and 36px below it. Default `md` buttons are 36px high from 768px and 40px below it. Keep these native sizes and their focus behavior instead of overriding dimensions in features. Native modals retain their own shape and spacing.

## Components

The public local inventory is `components/ui/index.ts`: HeroUI primitives are re-exported directly, with only the domain `MoneyValue` and `StatusChip` added. Features reuse the inventory. The shell uses native HeroUI navigation, dropdown, avatar, and button variants.

### Buttons

Compact native controls with explicit verbs. Primary commits/review actions use the accent variant; secondary provides quieter navigation, tertiary handles local cancellation, ghost serves shell or inline controls, and danger marks discarding. Pending controls use native pending/disabled states. Hover, keyboard focus, and pressed feedback remain library defaults.

### Chips

`StatusChip` uses native `sm` soft chips and `formatBusinessLabel`. Its default/success/warning/danger mapping is local presentation semantics. Labels carry the status; raw enums never appear in the interface.

### Cards / Containers

Finance summaries, editors, and context panels use one white rounded surface with internal spacing and dividers. Related metrics share the owning panel. Tables use native HeroUI framing, row surfaces, selection, focus, sorting, and scroll containers.

### Inputs / Fields

Native `TextField`, `NumberField`, `SearchField`, `Select`, `TextArea`, `Label`, `Description`, and `FieldError` retain their association and interaction contracts. Visible labels precede values. IDR number fields use Indonesian currency formatting. Project forms review the entered facts before saving; budget changes review the affected amount/state before committing.

### Navigation

The shell includes a skip link and a labelled main region. The active route uses a native secondary `sm` button variant and `aria-current`; inactive links use ghost styling. The account dropdown provides profile, password, and guarded sign-out. Manual app entry uses an independent admin origin/session with the same accounts and API; `use:desktop_admin` permits entry while domain permissions and project scope still govern visible actions.

### Draft Protection and Feedback

The shared `UnsavedChangesProvider` routes budget navigation through one native confirmation modal. Internal links, same-tab external links, and logout confirm discarding a dirty budget; browser unload uses its native warning. A pending operation blocks leaving. The project form handles discard/review stages inside its native modal and blocks pending dismissal.

Budget refresh and category switching are disabled while the draft is dirty; refresh is also disabled while pending. Clean server updates can refresh the visible budget, while a dirty or pending editor preserves local values. Successful explicit mutations replace the current data with the server response, show Indonesian status feedback, and refresh the route. Errors stay visible without silently discarding entered values.

**The Review Before Commit Rule.** Show the consequential facts and an explicit confirmation before mutations; keep pending state visible and prevent navigation or dismissal from abandoning an in-flight change.

## Do's and Don'ts

### Do:

- **Do** preserve the pinned HeroUI 3.2.6 defaults, semantic tokens, and native `sm`/`md` sizing.
- **Do** reuse the local public UI inventory, `MoneyValue`, `StatusChip`, and shared navigation guard.
- **Do** use compact labelled tables for comparisons and contextual surfaces for review/editing.
- **Do** keep translated statuses, tabular amounts, accessible labels, keyboard focus, and reduced motion.
- **Do** protect drafts during navigation, resize, refresh, and pending operations.
- **Do** retain permission-aware controls and explicit review with Indonesian mutation feedback.

### Don't:

- **Don't** import web/mobile UI or its palette, capsule fields, motion presets, or 48px sizing rules into this app.
- **Don't** override native HeroUI styling with a new brand palette, display font, shadow, or radius system.
- **Don't** replace category finance comparisons with decorative charts or repeated metric cards.
- **Don't** expose raw business enums, silently discard edits, or make mutations automatic.
- **Don't** treat this phase as complete workflow parity or remove the legacy desktop before full acceptance.
