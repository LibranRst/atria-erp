---
name: atria-knowledge
description: Provides fast indexed knowledge lookup across the entire Atria ERP documentation library, database schema specifications, business logic definitions, status enums, server action catalogs, and architectural guidelines. Use whenever searching for domain concepts, documentation locations, table definitions, or architectural context.
---

# Atria ERP Knowledge Base & Documentation Navigator

This skill serves as the indexed sitemap and knowledge directory for **Atria ERP**.

---

## 1. Core Documentation Sitemap

| Category | File | Description |
| :--- | :--- | :--- |
| **Product Overview** | [`docs/01-product/PRD.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/01-product/PRD.md) | High-level PRD, core user personas (Owner, Finance, Purchasing, PM). |
| **MVP Blueprint** | [`docs/02-product/MVP_BLUEPRINT.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/02-product/MVP_BLUEPRINT.md) | Scope boundaries, non-negotiables, deferred features. |
| **Business Flows** | [`docs/03-flows/FLOWS.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/03-flows/FLOWS.md) | Budgeting, expense claims, vendor bills, stock movements, reconciliation. |
| **Database Schema** | [`docs/04-data/DATABASE_SCHEMA.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/04-data/DATABASE_SCHEMA.md) | Comprehensive table definitions and foreign keys. |
| **Status Enums** | [`docs/04-data/STATUS_ENUMS.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/04-data/STATUS_ENUMS.md) | Canonical status enums, transitions, and business state machines. |
| **Seed Data** | [`docs/04-data/SEED_DATA.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/04-data/SEED_DATA.md) | Demo fixtures, default accounts, initial material catalog. |
| **API Actions** | [`docs/06-technical/API_ACTIONS.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/06-technical/API_ACTIONS.md) | Server Action signatures, parameter types, return values. |
| **Auth & RBAC** | [`docs/06-technical/AUTH_AND_PERMISSION.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/06-technical/AUTH_AND_PERMISSION.md) | Better Auth setup, role matrix (OWNER, FINANCE, PURCHASING, PM). |
| **Design Tokens** | [`DESIGN.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/DESIGN.md) | Complete color palette, typography scales, corner radiuses, components. |
| **Product Contract** | [`PRODUCT.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/PRODUCT.md) | Product positioning, principles, and accessibility requirements. |
| **Master Index** | [`docs/ANTIGRAVITY_INDEX.md`](file:///Volumes/DekoriaSSD/App%20Projects/Websites/atria-erp/docs/ANTIGRAVITY_INDEX.md) | High-density semantic map of entire system. |

---

## 2. Key Business Enums & Terminology

- **Budget Categories**: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, `SUBCON`.
- **Approval Statuses**: `DRAFT`, `PENDING_FINANCE`, `PENDING_OWNER`, `APPROVED`, `REJECTED`, `REVISED`.
- **Reconciliation Statuses**: `UNRECONCILED`, `PENDING_MATCH`, `RECONCILED`, `EXCEPTION`.
- **Stock Movement Types**: `STOCK_IN`, `STOCK_OUT`, `RESERVE`, `USE`, `RETURN`, `TRANSFER`, `ADJUSTMENT`, `WASTE`.
- **User Roles**: `OWNER`, `FINANCE_ADMIN`, `PURCHASING`, `PROJECT_MANAGER`, `DESIGNER`.

---

## 3. Codebase Directory Mapping

- `app/`: Next.js App Router pages and route handlers (`/ledger`, `/projects`, `/materials`, `/approvals`, `/settings`).
- `components/ui/`: Shared UI primitives (`MoneyValue`, `Button`, `SegmentedTabs`, `Badge`).
- `db/`: Database configuration, Drizzle client, and seed scripts.
- `db/schema/`: Schema table definitions.
- `features/`: Modular domain features containing server actions, components, and hooks.
- `lib/`: Utilities, authentication helpers (`lib/auth/`), motion presets (`lib/utils/motion.ts`).
- `.agents/`: Antigravity rules, skills, hooks, and configuration.
