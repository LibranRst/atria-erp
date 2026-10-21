# Desktop sheet resize continuity

User reports awkward desktop height expansion when opening budget details. The sheet animates height with the shared spring, while its inline top position immediately uses the target height. During collapse the observed vertical center drifts129.7px before settling.

Use the shared desktop viewport host as a flex centering owner and make the desktop sheet a relative flex item. Its center then follows its actual animated height continuously. Preserve the existing height spring, disclosure reveal, enter/exit transforms, natural content sizing, viewport cap, floating chrome, protected aside, focus ownership and mobile bottom anchoring. Add no motion token or feature-local overlay.

Verify expansion/collapse traces and rapid reversal in dev Browser at1024/1280/1440, plus mobile regression at320/360/390/430. Check viewport cap, scrolling and footer clearance. Existing sheet geometry/keyboard tests, scoped lint/typecheck/build, documentation parity and graph refresh close the change. No business data changes.

Verified: before-collapse center drift129.71px; fixed expansion, collapse and rapid reversal drift at most0.0078125px. Desktop widths1024/1280/1440 preserve the906px viewport cap at954px height. Mobile320/360/390/430 retain bottom gap0 and no document overflow. Raw traces and screenshots are under `output/ai-chat-qa/desktop-height-motion/`. Ten existing geometry/chrome/keyboard tests, scoped lint, formatting, web typecheck/build and layout detector pass. Shared FormSheet/BottomSheet ownership and mobile motion remain intact.

Finish review disposition: ship, with no material findings. The design geometry clause and its sidecar match exactly.

## Coordinated disclosure sizing

User reports remaining collapse lag. Coordinate shared FormDisclosure height reveals with the desktop sheet using a private shared content-size controller. Measure final intrinsic flow with animation styles temporarily set to their targets and restored before paint; the sheet and disclosure use the same existing ease transition. ResizeObserver must not repeatedly retarget a second spring to intermediate accordion sizes. Use layout box height, retain scrolling until a collapsing reveal finishes, and animate the inter-section gap inside the reveal rather than removing a margin after exit. Generic non-disclosure height changes retain the existing spring; mobile retains its prior sheet behavior. Test measurement style restoration and verify simultaneous capped/uncapped collapse, rapid reversal and mobile safety in dev Browser.

Verification: capped906→485 and uncapped629→424 collapse track disclosure progress with mismatch below0.00002 (fraction of animation), including desktop1024/1280/1440; center drift remains below0.008px. Both reach their final size together, without a delayed modal tail. Rapid reversal settles correctly; mobile320/360/390/430 retains bottom gap0/nooverflow. Evidence: `output/ai-chat-qa/collapse-sync/traces.json`. Target-measurement tests prove live styles restore even after an exception. All949 web tests, scoped lint/format, web typecheck/build and layout detector pass. Reduced motion makes reveal and chevron changes immediate.

Final coordination review: ship, no material findings. Actual mobile evidence is `mobile-390.png`; the stale renderer capture was removed.
