# Ringkasan Compact Sections

## Goal
Redesign only the `/ledger` Ringkasan tab section containers so the dashboard feels compact, minimal, and aligned with the hierarchy of the other app pages while preserving the fast 30-second financial scan.

## Direction
- Keep the financial pulse hero as the anchor.
- Replace the soft-panel experiment with a local `OverviewPreviewSection` style.
- Put the clean section title and generic CTA outside the content card.
- Use one compact white content card per section with subtle ring/shadow.
- Keep Prioritas first, but keep it visually equal to the other preview sections.
- Keep Proyek berisiko, Kesehatan kategori, and Aktivitas kas terbaru as compact previews.
- Default AI insight to collapsed.

## Scope
- Do not restyle Approvals, Budget Risk, Cash Due, or Materials tabs.
- Do not introduce colored section panels, section icons, accent lines, gradients, or new data requirements.
- Do not change approval/cash/material mutations.

## Verification
- Run `npm run lint`.
- Run `npm run build`.
- Browser-check `/ledger` Ringkasan at 320, 390, and 430 px for text overlap, tab links, default AI collapsed state, and tap targets.
