# Antigravity Workspace Customizations for Atria ERP

This directory (`.agents/`) contains the complete configuration and customization suite for **Google Antigravity** operating on **Atria ERP**.

## 1. Directory Structure

```text
.agents/
├── README.md               # Overview & documentation (this file)
├── hooks.json              # Antigravity lifecycle hooks (safety gates & reminders)
├── skills.json             # Workspace skills manifest
├── rules/                  # Granular workspace rules (auto-discovered)
│   ├── 01-design-system.md       # Calm Modern Luxury, iOS Paten forms, motion tokens
│   ├── 02-finance-safety.md      # Option A ledger model, Drizzle transactions, audit logs
│   ├── 03-material-control.md    # RAP vs RAB, stock movements, vendor bills, goods receipt
│   └── 04-codebase-standards.md  # Strict TypeScript, Server Actions, Better Auth RBAC
└── skills/                 # Progressive-disclosure runbooks
    ├── impeccable/SKILL.md       # Canonical UI/UX design & audit workflow
    ├── atria-finance/SKILL.md    # Financial ledger & reconciliation workflows
    ├── atria-material/SKILL.md   # Inventory & RAP material planning runbook
    ├── atria-qa/SKILL.md         # Automated quality gates, linting & seed verification
    └── atria-knowledge/SKILL.md  # Master index of all docs, schemas, and API actions
```

## 2. Canonical UI Design Sources
- `PRODUCT.md`: Product context and user/problem constraints.
- `DESIGN.md`: Atria's visual language, tokens, components, and anti-patterns.
- `.impeccable/design.json`: Impeccable's machine-readable design-system sidecar.
- `.agents/skills/impeccable/`: Impeccable workflow and command references.

`atria-design` is retired as a competing workflow. Existing references should use `impeccable` instead.

## 3. Root Rule Files
- `GEMINI.md`: Authoritative instructions for Gemini/Antigravity agents.
- `AGENTS.md`: Cross-agent standard development guidelines.

## 4. How Antigravity Uses This Setup
1. **Rule Ingestion**: Antigravity automatically discovers root `GEMINI.md` / `AGENTS.md` and `.agents/rules/*.md`.
2. **Progressive Disclosure Skills**: Skills in `.agents/skills/` are loaded dynamically when relevant to user requests.
3. **Safety & Invariants**: `.agents/hooks.json` monitors tool usage and injects project invariants.
