## Paduna Build design system — conventions

Paduna Build is Dekoria's mobile-first, iOS-style internal ERP for interior design/build project finance. These components are the real, compiled UI primitives from that app — build with them exactly as shown below, not with generic replacements.

### Setup

No context provider or wrapper is required to render any component in this bundle — every synced component is self-contained (props in, no required ambient context).

Fonts are **not bundled as files**; load them yourself so the components' `var(--font-inter)` / `var(--font-jetbrains)` references resolve:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

Body text and UI chrome use **Inter**; every monetary/numeric value uses **JetBrains Mono** with tabular numerals (see `.financial-amount` below) — never mix them up, money in Inter looks wrong immediately.

### Styling idiom: Tailwind utility classes on semantic tokens only

This is a Tailwind v4 codebase styled entirely through **semantic color/shadow tokens**, never raw hex, raw gray utilities, or arbitrary values. Compose real components with these real class names (all confirmed present in the compiled `_ds_bundle.css`):

| Role                   | Classes                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary action surface | `bg-primary text-on-primary` (near-black `#111`, not a brand hue — this product is deliberately monochrome + one accent)                                 |
| Accent / interactive   | `bg-accent text-on-accent` (`#007AFF`, iOS blue) — links, focus, selection only                                                                          |
| Page background        | `bg-background`                                                                                                                                          |
| Card / raised surface  | `bg-surface-container-lowest` (white), `bg-surface-container-low`, `bg-surface-container` (progressively deeper neutral fills)                           |
| Body / label text      | `text-on-surface` (primary), `text-on-surface-variant` (secondary/caption)                                                                               |
| Borders / dividers     | `border-outline-variant`, `ring-ring-control` (hairline control ring), `ring-ring-subtle`                                                                |
| Status                 | `bg-success-container text-success`, `bg-warning-container text-warning`, `bg-critical-container text-critical`                                          |
| Elevation              | `shadow-control` (inputs/pills), `shadow-surface` (cards), `shadow-raised`, `shadow-floating`, `shadow-sheet` / `shadow-overlay` (bottom sheets, modals) |
| Focus ring             | `focus-visible:ring-2 focus-visible:ring-focus-ring` — never a component-local focus color                                                               |
| Money/numeric text     | add the `financial-amount` utility class (tabular-nums + safe wrapping) on top of `font-mono text-*`                                                     |

Shape language: **fully rounded pills** (`rounded-full`) for buttons, tabs, badges, inputs — flatter `rounded-2xl`/`rounded-3xl` only for cards and sheets. Nothing in this system uses sharp corners.

### Where the truth lives

- `styles.css` (root of this bundle) — the full token set (`@theme` block: every color/shadow/spacing/font variable above, plus spacing scale `--spacing-xs` 8px … `--spacing-xl` 32px).
- `_ds_bundle.css` — compiled component styles; read it before inventing a new utility combination.
- Each component's own `<Name>.prompt.md` — usage notes and prop shapes for that specific component.

### One idiomatic build snippet

```tsx
<div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-surface">
  <StatusBadge tone="pending" label="Menunggu" />
  <p className="mt-2 text-sm font-semibold text-on-surface">Pembelian Semen</p>
  <p className="financial-amount mt-1 font-mono text-lg font-bold text-on-surface">Rp 6.400.000</p>
  <Button variant="primary" fullWidth className="mt-4">
    Setujui
  </Button>
</div>
```

Copy in this product is **Bahasa Indonesia** — match it when generating placeholder content; don't default to English strings.
