# AI Agent Development Guidelines (AGENTS.md)

Welcome, AI Agent! You are working on **Atria ERP**, a critical, production-grade, finance-first internal application. Because this app directly manages cash flows, bank reconciliations, and project budgets, you must adhere to the strict guidelines and guardrails detailed in this document. 

---

## 📋 1. Rules on Planning & Execution

1.  **Read Before Writing:** You must read existing schemas and API documentation before proposing any changes. Do not guess file structures, database relations, or variable names.
2.  **Implementation Plans:** Before writing any executable code, you **must** write a detailed step-by-step implementation plan. Save this plan under `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` and wait for user approval.
3.  **TDD & Verification:** If the user specifies or the task demands, write failing tests first, run them, write minimal implementation code, verify they pass, and commit.
4.  **No Placeholders:** Never output code containing `// TODO`, `// TBD`, or incomplete statements. Every function, schema, and API action you build must be fully implemented, validated, and documented.

---

## 💻 2. Engineering & Security Rules

### Strict TypeScript
*   Disable `any` entirely. Use concrete types, generics, or type utility helpers.
*   All function arguments and return types must be explicitly defined.
*   Avoid using type assertions (`as Type`) unless interfacing with un-typed third-party libraries. Instead, use proper type guards or Zod parsers.

### Schema Validation (Zod)
*   Every Next.js Server Action or API endpoint must validate its incoming payload using a Zod schema.
*   Zod validation schemas must reside in a centralized location, such as `lib/validations/` or alongside the corresponding database schemas.
*   Validate string lengths, number bounds, email formats, and UUID formats strictly. Do not accept raw, unvalidated strings for IDs.

### Drizzle ORM Rules
*   Use Drizzle's relational query API (`db.query.tableName.findMany(...)`) for type-safe fetches.
*   Declare foreign keys and index relations explicitly in the database schema to prevent database leaks or orphan rows.
*   Database updates must use the Drizzle query builder (`db.insert`, `db.update`, `db.delete`). Do not construct raw SQL template strings.

### Role-Based Access Control (RBAC) & Mutations
*   **Role Validation:** All Server Actions that mutate data must run a security checker (e.g., `checkPermission(session.user, 'action_name')`).
*   **Scoped Access:** A Project Manager (PM) should only be allowed to modify data belonging to projects where they are explicitly assigned. Owner and Admin roles have global project read/write access.
*   **Session Security:** Read the user session directly on the server side using Better Auth. Never rely on client-provided user IDs for mutations.

### Database Safety & Transactions
*   Any operation that changes balances or affects multiple tables (e.g., approving an invoice and updating the project budget) **must run inside a database transaction** (`db.transaction(async (tx) => { ... })`).
*   If any step inside the transaction fails, throw an explicit error to roll back all changes. Partial database writes are unacceptable.

---

## 🎨 3. UI/UX Rules (iOS 26 Solid Philosophy)

Atria ERP is built for Project Managers working in noisy, bright construction fields. The interface must look and feel like a premium, native iOS app wrapped in a mobile WebView.

### Layout & Navigation
*   **Bottom Navigation Bar:** Mobile views must utilize a sticky bottom navigation bar for quick access to primary modules: Projects, Ledger, Add Expense, and Profile.
*   **Touch Targets:** All interactive elements (buttons, inputs, select triggers) must have a minimum touch target size of **44x44 pixels** to prevent accidental taps.
*   **Grid and Cards:** Group data into dense, cohesive cards. Use distinct visual borders and shadows rather than plain list rows.

### Styling System (iOS 26 Solid Aesthetics)
*   **Color Palette:** Use clean HSL-based colors. Avoid bright default primary colors. Instead, use deep indigos, charcoal grays, emerald greens for success, and amber tones for warnings.
*   **Glassmorphism:** Apply micro-borders, clean drop-shadows, and background blur effects (`backdrop-blur-md`) on panels, headers, and modal sheets.
*   **Border Radii:** Use smooth, large border corners:
    *   Small buttons/badges: `rounded-lg` (8px)
    *   Standard cards: `rounded-2xl` (16px)
    *   Bottom sheets/Modals: `rounded-t-3xl` (24px)
*   **Typography:** Default to clean, modern sans-serif fonts (e.g., Inter, Outfit). Maintain strict hierarchy: large titles (`text-2xl font-bold tracking-tight`) and compact, high-contrast sub-labels (`text-xs font-medium text-muted-foreground`).

---

## 🚫 4. Strict Financial Guardrails

To prevent financial discrepancies and secure company funds, you must abide by the following:

1.  **NEVER Execute Raw SQL:** You are strictly forbidden from writing or executing raw SQL strings (e.g., `db.execute(sql`...`)`) inside the application code. This is to eliminate SQL injection vulnerabilities and ensure all queries go through Drizzle's compiler.
2.  **NEVER Mutate Reconciled Transactions:** A ledger transaction (`cash_transaction`) that has been marked as `reconciled = true` **cannot be edited or deleted**. If a correction is needed, you must create a compensating reversal transaction (a journal entry offset) with an audit note.
3.  **Explicit User Approval for Money Movements:** Never write logic that automatically creates or modifies bills, payments, or invoices without explicit user triggers. Any fund disbursement requires an explicit approval request from an Owner or Admin.
4.  **Enforce Ledger Balance Double Check:** Whenever a cash transaction is recorded, you must update the associated `bank_account` current balance. Verify that:
    $$\text{New Balance} = \text{Old Balance} \pm \text{Transaction Amount}$$
    If Drizzle reports that the updated rows do not match the expected count, abort the transaction.
5.  **Audit Trail Logging:** Every balance-changing query must write a record into the `audit_log` table containing the user ID, timestamp, target record ID, original state, and new state.

If any task or code suggestion violates these guidelines, refuse to write it and ask the user for clarification.
