# Design Specification: Finance-First ERP Documentation System

**Date**: 2026-06-11
**Status**: APPROVED
**Author**: Tech Lead / Architect

## 1. Overview

Rebuilding an internal ERP application for an interior design and contractor company from scratch, shifting the focus from a previous project-management-centric design to a **finance-first** mobile UX operational system.

## 2. Key Architectural & Product Decisions

- **Ledger-Based Transaction Model**: Every financial movement (client receipt, vendor payment, petty cash expense) will be recorded as a transaction mapped to bank accounts and specific BoQ budget items. This ensures high accuracy and auditability.
- **Mobile-First Interface**: Primary UX is optimized for single-hand mobile usage (bottom navigation, large tap targets, bottom sheets for inputs, cards instead of complex tables).
- **Flexible Billing**: Client invoices support milestone-based terms as well as ad-hoc billings.
- **Hybrid AP Tracking**: Expense inputs support both immediate cash outlays (e.g. petty cash) and accounts payable (vendor bills) matched to project items.
- **Gemini-Powered AI Briefing**: Daily owner briefing summarizing profitability, cash flows, and suggesting actionable steps without direct write permissions to the database.

## 3. Documentation Structure

The project will be fully documented using the following file tree:

- `/README.md`
- `/AGENTS.md`
- `/docs/01-product/PRD.md`
- `/docs/02-product/MVP_BLUEPRINT.md`
- `/docs/03-flows/FLOWS.md`
- `/docs/04-data/DATABASE_SCHEMA.md`
- `/docs/04-data/STATUS_ENUMS.md`
- `/docs/04-data/SEED_DATA.md`
- `/docs/05-ui-ux/MOBILE_FIRST_UI_UX.md`
- `/docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`
- `/docs/06-technical/STACK_DECISION.md`
- `/docs/06-technical/ARCHITECTURE.md`
- `/docs/06-technical/AUTH_AND_PERMISSION.md`
- `/docs/06-technical/API_ACTIONS.md`
- `/docs/06-technical/AI_AGENT_ARCHITECTURE.md`
- `/docs/07-development/ROADMAP.md`
- `/docs/07-development/TASK_BREAKDOWN.md`
- `/docs/07-development/IMPLEMENTATION_ORDER.md`
