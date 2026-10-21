# Complementary AI answers and result cards

Status: implemented and verified in development.

## Request and findings

The final assistant bubble must complement its following card instead of duplicating the same rows. The reported company cash question repeats every bank account in both the server-grounded answer and `BankBalancesResult`. The existing model prompt already limits repeated rows; grounded facts bypass model wording, so prompting alone cannot fix this.

## Approach

Keep the complete source-verified answer as the canonical stored fallback. Supply typed, source-authored optional card narratives for exact text sections and matching tool calls. The web presentation uses those narratives only once a matching, usable result card is actually selected and displayed. Partial/error guidance, unrepresented facts, and unsupported/no-card results retain their complete text. No substring heuristics over arbitrary model text, extra model calls or changes to financial calculations, authorization, approval or transactions.

- Cash: a company-wide question has one brief conclusion without another account list or repeated per-account values. A named account/bank keeps the requested scoped conclusion because the card contains the company-wide list.
- Budget: omit only fields represented in displayed category rows; keep paid/pending values and requested contract/RAB/progress/margin qualifications. Share the existing category selection policy so hidden card rows still receive adequate answer text.
- Other model answers: reinforce complementary copy for existing result/proposal cards. Do not remove grounded stock, document or historical facts that currently lack a result card.
- UI: retain the existing ChatBubble, ChatMarkdown, ToolTraceList and result-card components, their order, responsive sizes, motion and state owners. History uses the same verified presentation metadata; legacy messages remain intact.

## Verification

Test exact cents/provenance, aggregate versus named cash, matching/missing/invalid/suppressed cards, multiple reads, partial errors, budget hidden rows and missing-card facts. Preserve stream/introduction/recovery behavior. Run scoped tests, app typechecks/lint/format checks, and real local Browser cash/budget requests with desktop/mobile preview. Use the existing private QA database; do not confirm business mutations. Compare protected business snapshots after verification.

## Results

The real cash request displayed zero lists in its introduction/final answer bubbles and exactly one complete cash card. This remained true after refresh and at all seven required widths, without document overflow. A fresh budget overview kept contract/paid/pending and requested qualifications, with no repeated category list. Explicit named/hidden/all-category/detail behavior is covered by regression tests.

125 scoped API/web tests passed. API, web and mobile typechecks, scoped API/web/core ESLint, scoped formatting and diff checks passed. All 61 protected business table snapshots were unchanged; no business action was confirmed. There is no extra model call for presentation. Existing histories lacking the new source-authored metadata keep their canonical text; newly persisted responses restore the same compact view.

Evidence: `output/ai-chat-qa/card-complement-2026-10-14/verification.json`, `responsive-cash.json`, `final-cash-preview.png`, `mobile-cash.png` and `desktop-budget-final.png`.
