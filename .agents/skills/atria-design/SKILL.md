---
name: atria-design
description: Compatibility alias for Atria ERP UI work. Use the canonical impeccable skill with PRODUCT.md, DESIGN.md, and .impeccable/design.json; do not use this alias as a separate design system.
---

# Atria Design Compatibility Alias

The canonical UI/UX workflow is the `impeccable` skill at `.agents/skills/impeccable/SKILL.md`.

Load `impeccable` for all UI planning, implementation, styling, redesign, audit, review, accessibility, responsive, motion, and polish work. Read these Atria sources before making a UI decision:

- `PRODUCT.md` for product context and user constraints.
- `DESIGN.md` for the visual system, semantic tokens, component language, and anti-patterns.
- `.impeccable/design.json` for Impeccable's machine-readable design-system sidecar.

Keep Atria's domain runbooks separate: use `atria-finance` for ledger and financial integrity, `atria-material` for inventory/RAP/RAB, `atria-qa` for quality gates, and `atria-knowledge` for documentation navigation.

Do not add UI-specific rules, raw color values, raw shadow values, or duplicate motion guidance here. Update the canonical Impeccable/design artifacts instead.
