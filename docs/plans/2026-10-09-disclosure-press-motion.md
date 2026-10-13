# Disclosure press motion

User requests no press scale on accordion elements; ordinary button feedback stays.

Keep the shared FormDisclosure trigger and the existing onboarding accordion header stationary for all variants (including AI activity). Preserve shared chevron rotation and height/opacity reveal as the meaningful state transition, along with keyboard, focus and ARIA behavior. Use the existing native button semantics; add no primitive, dependency or motion preset. Other action buttons and navigation/edit rows retain their established feedback.

Verify in the dev Browser that disclosure presses remain at scale1 on mobile/desktop while ordinary action buttons still scale, and that disclosure expansion/keyboard behavior remains functional. Run relevant shared form tests, scoped lint/types and record the motion rule.

Verified: dev Browser disclosure transform remains `none` during pointer-down checks in desktop/mobile presentation; ordinary Close button retains press scale (`matrix(1.04846, 0, 0, 1.04846, 0, 0)`). Mouse release opens the desktop disclosure; Enter expands/collapses on mobile. Shared form/tool-trace/onboarding tests pass (16), along with the existing RAP confirmation DOM guard. Scoped lint, formatting, web typecheck and build pass. Evidence: `output/ai-chat-qa/disclosure-motion/`. Design motion rule and sidecar retain exact parity; no business behavior changed.
