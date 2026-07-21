# High-Risk Form Redesign V2

## Intent

- Extend form consistency into guided high-risk workflows: Project, Expense, Stock, and Finance forms.
- Keep the tone subtle and operational. Preview and warning copy should help users avoid mistakes without gamifying the ERP.
- Preserve existing Server Actions, schemas, RBAC, and mutation behavior.

## Implementation Defaults

- Use shared `FormRiskNotice` and `ValuePreviewStrip` for form guidance.
- Avoid visual completion meters in operational forms; rely on defaults, disabled states, and concise helper copy instead.
- Preview financial, stock, or identity consequences before submit without mutating data.
- Keep all money and stock actions explicit.
