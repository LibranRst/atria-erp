# Faster complete AI responses

Status: implementation and sampled development Browser verification complete. Settings meets the qualified sample target; profile/document distributions remain under-sampled. The full test runner retains one unchanged UI timeout whose isolated retry passes. Scope remains development/live QA. Production is unchanged.

## Acceptance

Measure useful response/proposal completion, including required fresh reads, document extraction and persistence. A loading label or queued analysis does not count as completion. Aim for median <=5 seconds and at least 95% <=10 seconds for text questions, action proposals and ordinary short documents. Larger documents keep all supported content and have a separate measured target. These are acceptance targets, not a guarantee that an external provider always responds within ten seconds.

Preserve financial correctness, exact money, current scoped source reads, role/tenant/private-file access, confirmation, cancellation, stale-data checks and idempotency. Existing production deployment and its configuration are outside this change.

## Baseline

The prior accepted live samples completed a fresh Settings question in 20.478 seconds and a long factual conversation in 18.473 seconds. No phase timings or repeated latency distribution were recorded. An earlier 9.612-second tool-error sample is not valid performance evidence. Document image extraction previously took 21.1 seconds for five items; that historical sample is not a current percentile.

## Sequence

1. Add content-free request/model/tool/document timing and a repeatable completion benchmark. Capture initial live QA runs, including accuracy and errors, before enabling changes.
2. Evaluate adaptive reasoning within the configured approved model family. Lower effort is conditional on task complexity and must pass the same correctness tests. Retain custom configured models and approved fallback policy.
3. Bound obsolete generation history while preserving recent context, pending workflow, reference resolution and server confirmation evidence. Persisted/UI history stays complete; financial facts are freshly read.
4. Reduce duplicate immutable document processing, with private-file authorization checked on every request, bounded cache size and versioned content identity. Keep full-page/row coverage and validate extracted fields. Test single-pass/simple document options rather than assuming they are accurate.
5. Compare live Browser completion times for short facts, an action proposal, long-history follow-ups and ordinary document cases. Report measured sample counts, median/p95, errors and correctness; do not claim the target if the distribution does not support it.

Run focused regression tests for changed seams, API/web/mobile types, lint and formatting. Use only an explicitly disposable QA database for live integration and no business confirmation without the existing explicit action contract. Refresh the repo graph after the changes.

## Measured outcome — 14 October 2026

The final report retains 37 actual Browser completions across separate baseline, transition, final first-use and cache-warm variants. Settings has 20 correct final samples: median 193ms, nearest-rank p95 679ms and 20/20 correct completions within ten seconds. This path freshly reads authorized server policy; it is not a model-generation speed claim. Three independent literal own-name proposals complete in 4.763/4.453/3.461s (median 4.453s). Two new PNG readings complete in 5.559/5.578s; a third has only a 3.706s server completion record because the Browser resource buffer was full and no older entry was reused. A short PDF completes in 6.592s on first use and 0.410s with a warm artifact cache. The smaller profile/document groups remain insufficient for qualified p95/target claims.

The 24.160s own-profile attempt from a long attachment-heavy conversation under heavy test load remains in the report. The literal-name history exception changes model input only; the route may still preprocess older uncached attachments/PDFs first. Mixed, reference-dependent and complex workflows retain their full safety/context path. No universal five- or ten-second guarantee is claimed.

Final read-only QA evidence compares 61 protected business/credential table counts and hashes with the initial BEFORE snapshot: all remain identical. Only allowed chat/attachment metadata changes. The retained disposable container survived an OrbStack stop without reset/seed/migration; its binding changed from loopback32774 to loopback32768 and the operator guard remains exact. API/web/mobile types, workspace lint and the API build pass; scoped latency formatting passes. Repository-wide formatting retains 83 byte-identical release-baseline files and four generated/cache findings without a baseline. The final full test command exits 1 on one unchanged desktop-select 60-second timeout; its isolated retry passes unchanged in 34.41 seconds and the separately run development scripts pass. Distinct outcomes are 2,457 passing tests and 560 expected database-integration skips, with no unresolved assertion failure. The full-suite timeout remains explicit in the verification guide.

See `docs/guide/ai-response-latency-verification-2026-10-14.md`, `output/ai-chat-qa/latency-2026-10-14/browser-report.json` and `business-invariant-summary.json` in that evidence directory. Further distribution confidence needs at least 20 independent final samples per profile/document variant, plus broader mixed/large-document and hosted-production measurements.
