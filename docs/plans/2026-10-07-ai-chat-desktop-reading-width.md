# Desktop AI chat reading widths

Approved through grilling: center a 664px conversation lane aligned with the visible composer; cap assistant content/cards at 600px and user bubbles/attachments at 480px. Short messages keep intrinsic width. Assistant content remains left aligned; user messages remain right aligned. Chat cards share one limit; data-heavy review continues in the existing wide workspace/overlay.

Apply width ownership to AiChatView, ChatMessage and ChatBubble using the workspace presentation context, preserving surface=mobile and all mounted identities. Keep shared proposal/result shells width-neutral, history workspace sizing, motion, scroll anchoring, drafts and wide review portals intact. Reuse existing components; no new primitive or business/API changes.

Verify in the dev app through @Browser at desktop 1024/1280/1440 and mobile 320/360/390/430, including short/long messages, cards, attachments, resize and focused composer state. Run existing relevant tests, web quality checks, owned formatting and graft refresh.

Verified in the dev app: desktop lane/composer 664px with identical left edges; assistant/card 600px; long user message 480px; short assistant bubble 117.5px. All seven widths had no page overflow, including a long unbroken reference, and retained a focused wizard draft. Existing mobile proportions stayed 85%/94%. Native surface=mobile at 1280px retained the 448px mobile shell. A real Material Master review opened at 1024px with a 976px table, independently of the chat cap, without editing selection or saving. Labelled local stream fixtures were cleared; no business records were written.

Existing chat/scroll/resize regressions: 28 passed. Web typecheck/lint/build and owned formatting passed; lint retains the existing unrelated material proposal dependency warning. Reused ChatBubble/ChatMessage and existing proposal/result shells, composer controls, motion and wide review infrastructure. No new primitive.
