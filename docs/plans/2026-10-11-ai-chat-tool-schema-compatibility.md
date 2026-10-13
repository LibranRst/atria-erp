# AI chat tool-schema failure

Symptom: every chat attempt showed the generic assistant failure, including a fresh one-line greeting. Browser retry reproduced the exact error. A synthetic provider probe answered without tools and failed with the full catalog: HTTP400, `function_declarations[62].parameters.properties[payload].properties[email].enum[0]: cannot be empty`.

Cause: the catalog vendor contract inherited a blank-string literal from the manual form email schema. The SDK emits `const: ""`; the Gemini gateway converts it to an unsupported empty enum. Provider credentials/model lookup were valid. One invalid tool schema blocked unrelated chat messages before any response.

Fix: the AI catalog email field keeps omitted/null/blank support and trim/lowercase normalization, with runtime email and length validation. Its model-facing schema uses an optional string rather than a blank literal. The manual public contract and provider approval/order/configuration are unchanged. A regression test serializes every Owner tool through the installed SDK's asSchema and rejects empty enum/const branches; core tests cover create/edit email acceptance, clearing and invalid addresses.

Verification: regression was red on the two catalog create/edit email branches, then green. The same full-catalog live provider probe now answers. Dev-app @Browser greeting and actual project lookup/clarification are verified without a business confirmation. Temporary error-category instrumentation and probe source are removed from application paths; credentials, prompts and provider error bodies remain absent from logs.

Status: complete.

The live Browser greeting returned a normal answer; the realocation request reached project lookup and an input wizard with no generic stream error and no business save. Evidence: output/ai-chat-qa/chat-schema-fix/dev-chat-working.jpg. All 2,037 workspace tests and the focused13-test stream/privacy/schema suite pass, as do API/web/mobile typechecks and zero-error lint (one existing Material Master effect warning). Scoped formatting passes; unrelated workspace formatting drift remains. Graph refreshed after the final documentation change.
