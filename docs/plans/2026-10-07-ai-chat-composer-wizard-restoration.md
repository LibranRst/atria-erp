# Composer wizard restoration

Approved by the user: restore structured input as the default step-by-step composer wizard, adapted to the redesigned composer, with seamless animation and access to ordinary message entry without losing wizard progress or the message draft.

Keep one stable composer owning surface. Animate its measured physical height with shared spring presets; crossfade/slide the incoming mode and field without scaling text. Outgoing content leaves flow through popLayout and cannot receive focus/input. Reduced motion removes spatial movement. Normal draft/attachments stay owned by AiChatView; controlled wizard values/current/furthest step stay above mode swaps and survive resize and intervening conversation.

Reuse IconButton, Button, ActionMenu, grouped form controls, AdaptiveSelect and DatePickerField. Extend FormSection with embedded grouped presentation and numeric/money autofocus forwarding. Avoid restoring legacy raw controls and local overlay infrastructure. Select/date use explicit Next so their shared overlays finish dismissal and focus restoration before changing fields.

Keep the latest unanswered input request active through unrelated replies; detect formatted submission/cancellation in persisted history so completed requests do not resurrect. A newer request replaces the prior one. Sending wizard data remains a chat reply, preserves unrelated composer text/attachments and never confirms a business proposal.

Verify step navigation, earlier-field edits, validation, IME/Enter, select/date overlays, mode interruption, text/progress preservation, full submission/cancellation, stream/Stop and resize in the real dev app through @Browser at 320/360/390/430/1024/1280/1440px. Use labelled local stream fixtures for deterministic UI checks, clear them afterwards, and do not save business data. Complete scoped tests and workspace gates; update docs and refresh graft.

## Verification

The real dev app restores the unanswered project wizard in the footer. A separate dev tab exercised labelled, intercepted UI replies without backend writes. Normal draft and wizard name/nominal/step survived mode swaps, an unrelated reply and correction of a visited field. Empty required input produced feedback; Enter advanced text, shared dropdown and calendar completed selection before Next, and numeric/date/currency values survived all seven viewport widths with focus preserved and no document overflow (16px mobile controls, 14px desktop). The measured owner/body both settled at 208px in the filled fixture.

Final submission sent all five formatted values, including a decimal rupiah amount, chosen category label, ISO date and numeric ratio, with zero attachments. The unrelated normal draft remained unchanged. Cancellation sent the explicit cancellation reply. Neither path confirmed a business proposal. All intercept patterns were cleared and the QA tab closed; the user's current dev tab and its input were left intact. Evidence: `output/ai-chat-qa/wizard-restored-mobile.jpg`, `wizard-restored-desktop.jpg`, `wizard-responsive.json`.

Workspace tests, lint, build and web/mobile typechecks pass; lint retains the pre-existing material-proposal effect dependency warning. Owned files pass formatting and the UI detector reports no findings. Preview confirmation corrected compact currency-chip sizing (fixed shared MoneyValue type size rather than fit mode in an intrinsic-width button); its amount now measures 14px and has visible width. Mode/field exit content is inert, focus transfers only to the incoming field, and value updates merge against current progress to avoid reverting a later step. Shared FormSection embedded presentation has a representative story and association/surface test.
