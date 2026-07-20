# Global Material & Stock Control Center

Rewrite `/materials` into the fixed-width mobile operational workspace for inventory visibility, project stock operations, Goods Receipt, transfer, stock count approval, and audited receipt reversal. Material identity/defaults remain in Settings.

## Integrity

- All stock mutations are Zod validated, permission checked, row locked, transactional, and audited.
- Transfer preserves quantity/value across locations.
- Stock count changes inventory only after Owner/Finance approval.
- Receipt reversal is compensating history; posted rows are never deleted.

## Verification

- Targeted warehouse/RBAC tests, TypeScript, ESLint, build, additive migration smoke, and 320/360/390/430px browser checks.
