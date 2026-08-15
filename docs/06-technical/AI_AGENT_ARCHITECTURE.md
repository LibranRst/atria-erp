# AI Agent Architecture

## Principle

AI is read-only by default. It may analyze, summarize, classify, and propose actions, but it must not mutate important finance or material-control data without explicit user approval through protected Server Actions.

## Agents

### Chat Agent (implemented)

Reachable from the chat button in the app header; there is no AI entry point on the Dashboard.

- Model: `deepseek-v4-flash` primary, `gemini-3.7-flash` fallback. Fallback is decided **before the first token** only; a mid-stream failure surfaces as a retryable error instead of splicing two streams (`lib/ai/chat-stream.ts`).
- Transport: `app/api/ai/chat/route.ts`, the one internal API route, opened because `useChat` needs HTTP streaming. Read-only.
- Tools live in `lib/ai/tools/`. Every tool is read-only; `lib/ai/tools/read-only.test.ts` fails the suite if one ever writes.
- Session identity and role are closed over from the verified session — the model never supplies a user id or role. Any `projectId` the model provides is re-checked with `canAccessProject` before a query runs.
- Access requires the `use:ai_chat` permission (Owner, Finance Admin, Project Manager). The header button is hidden for roles without it.
- Conversations persist in `ai_conversation` / `ai_message`; history is always re-read server-side, never trusted from the request payload.
- Agent steps are capped at 8. DeepSeek V4 Flash calls tools far more often than Gemini, so the cap and a provider-specific system prompt keep latency and cost sane on mobile.

#### Tools

Every tool is gated by the same `PermissionKey` the rest of the app enforces, then scoped again per project for roles without global scope.

| Tool                   | Permission                 | Scope                                                                      |
| ---------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `listProjects`         | —                          | Own projects unless global scope                                           |
| `getProjectBudget`     | —                          | Re-checks project access                                                   |
| `getProjectHealth`     | —                          | Re-checks project access                                                   |
| `getBankBalances`      | `view:bank_account`        | Global only (Owner, Finance Admin)                                         |
| `getPendingApprovals`  | `view:cost` + global scope | Global only — an approver's queue, never a PM's window into other projects |
| `getUpcomingBills`     | `view:vendor_bill`         | Restricted to accessible projects inside the query                         |
| `getMaterialShortage`  | `view:material`            | Re-checks project access                                                   |
| `getRecentExpenses`    | `view:cost`                | Restricted to accessible projects inside the query                         |
| `getExpenseCategories` | —                          | Settings reference data                                                    |
| `proposeExpenseDraft`  | `create:cost`              | Re-checks project access                                                   |

A denied tool returns the refusal **as data**, so the model can explain it, rather than throwing and killing the whole answer.

#### Expense proposal (the only path to a write)

`proposeExpenseDraft` writes nothing. It resolves the project, resolves the budget category **within that project's budget**, computes the total, flags whether the amount exceeds the category's remaining budget, and returns a proposal object.

The UI renders that object as a confirmation card (`features/ai-chat/components/expense-proposal-card.tsx`). Only when a human presses the button does `app/actions/ai/confirm-expense-proposal.ts` run, and that action holds no financial logic of its own: it re-validates the shape with `lib/validations/ai-proposal.ts` and delegates to `submitFieldRequest` — the same path the manual form uses, with its own RBAC, project scoping, transaction, and audit trail.

The proposal schema deliberately accepts only the fields `submitFieldRequest` needs. Stock handling, material id, and RAP item id are **not** accepted from this path, so an AI conversation can never trigger a stock side effect. The resulting record is attributed to the confirming user, never to the assistant.

There is no auto-submit, and no `sendAutomaticallyWhen` on the client.

**Confirmation is idempotent per card.** Each proposal card carries the AI SDK `toolCallId`, which is persisted inside `ai_message.parts` and therefore survives a reload. Confirming records a row in `ai_proposal_confirmation` keyed by that id under a UNIQUE constraint, so one card can only ever produce one document — whether the button is double-clicked, two requests race, or the conversation is reopened later. When history loads, `loadConfirmedProposals` returns the executed ids and the card renders as already sent, with no button at all.

Without this, a reloaded conversation would re-offer the confirm button on a proposal that had already been recorded, and a second expense would be created for the same request.

## Rendered tool results

Answers are not plain prose. Every data tool's output is rendered as a card in the chat surface, built from the shared `components/ui` primitives (`GroupedSurface`, `MoneyValue`, `StatusBadge`, `BudgetSplitIndicator`), so a chat answer reads in the same visual language as `/ledger`.

Three rules hold this together:

1. **One source of truth for output shape.** `lib/ai/tool-output.ts` holds Zod schemas for every tool's output and carries no `server-only` marker, so tools build their return values from it and client renderers `safeParse` it. Outputs are persisted as JSON in `ai_message.parts` and read back as `unknown`; without a shared schema the renderer would silently drift from the tool and display wrong values.
2. **Renderers degrade, never guess.** `features/ai-chat/components/tool-results/` maps tool name → component. An unregistered tool, a failed parse, or an access-denied result contributes only a trace line. Messages stored before a field existed (for example before tool outputs carried `projectId`) still render, just without the deep link.
3. **The prompt names the tools that have cards.** `TOOLS_WITH_CARDS` is consumed both by the renderer registry and by the system prompt, and a test asserts the two lists match. Telling the model abstractly that "the interface shows cards" was measured and did not work — it kept restating the whole table. Naming the tools cut a typical answer from ~620 characters of bullet list to ~280 characters of prose that leads with the judgement.

Cards are rendered outside the answer bubble at full width: nesting card padding inside bubble padding squeezes the number column until a primary money value wraps at 320px.

Tool traces collapse to a single expandable line, and stay expanded while running or when a tool failed — the two moments where the detail is what the user needs.

`suggestFollowUps` is a read-only tool that only validates and de-duplicates the model's own suggestions, returning them as structured data so the interface can render real buttons. It runs as the last step, which is why `stopWhen` is 10 rather than 8.

## Conversations

Conversations are listed, switched, and deleted from inside the chat sheet (`features/ai-chat/components/conversation-picker.tsx`). "Mulai percakapan baru" creates an empty conversation server-side first, so its id is available to a proposal card from the very first message; the title is filled from that first message by `setConversationTitleIfEmpty`, which is safe to call repeatedly because it only writes when the title is still null.

Deleting a conversation removes its messages and confirmation records. It deliberately does **not** remove documents that were already created from its proposal cards — a recorded expense is a financial record, correctable only through the proper reversal path.

### OCR Receipt Agent

- Reads receipt images and extracts vendor, date, amount, and line items.
- Suggests material/RAP links when text matches material names or categories.
- Output is a draft proposal for the user to review.

### Finance & Material Brief Agent

- Writes a simple Bahasa Indonesia brief for the Owner.
- Summarizes category budget usage, budget risk, margin risk, material shortage, overbudget projects, unusual material cost, leftover/reuse opportunity, vendor/payment issues, and suggested actions.

### Risk Agent

- Reads project value, budget categories, actual category cost, RAP, stock shortage, vendor bills, and movement history.
- Identifies project margin risk and material-control bottlenecks.

## Data AI May Read

- Project budget and actual cost aggregates.
- Settings-backed expense categories and Budget Allocation defaults.
- Category budget cards: Tukang, Material, Operasional, Lain-lain, and Subcon budget/actual/remaining/used/status.
- Item & Price Library references for draft suggestions only.
- RAP item status and shortage calculations.
- Inventory availability, reserved stock, and leftover/reusable stock.
- Vendor bills due and recent project expenses.
- Historical `ai_run` summaries.

## Data AI Must Not Expose

- Internal RAP cost, margin, markup, vendor notes, or internal notes in client-facing RAB output.
- Global cash/ledger data to users without permission.
- Other PM projects to scoped project users.

## Mutation Rule

AI output can power proposal cards or prefilled forms. Final writes must be triggered by a human action and routed through Zod-validated, RBAC-protected Server Actions.

This is enforced mechanically, not just by convention. `lib/ai/tools/read-only.test.ts` fails the suite when any file under `lib/ai/tools/` contains `db.insert`, `db.update`, `db.delete`, `db.execute`, a transaction, or an import from `@/app/actions/**`. Adding a write-capable tool requires deleting that test, which is the point.

## Prompt Injection

Names, notes, and descriptions returned by tools are text other users typed. The system prompt states explicitly that tool output is data and never an instruction. Because every tool is read-only, the worst case for a successful injection is a misleading answer, not a mutation — which is the main reason the read-only rule is enforced by test rather than left to review.

## Output Language

Owner-facing summaries should be practical, short, and written in simple Bahasa Indonesia.

## Required Budget Analysis Examples

AI should be able to produce practical statements like:

- "Project A sudah memakai 92% Budget Material, sementara progress proyek baru 60%."
- "Biaya Tukang Project B masih aman di 55%."
- "Operasional Project C sudah over budget."
- "Stock material gudang bisa mengurangi kebutuhan beli Project D."
- "Margin Project E berisiko karena Material dan Subcon melewati rencana."
