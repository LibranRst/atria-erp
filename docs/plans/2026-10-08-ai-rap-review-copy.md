# RAP review business decisions

User found the review's wizard transitions confusing and approved replacing them with concrete decisions.

- Rename the review section to “Yang akan disimpan”. Retain package Ready, explicit scope decisions and RAP lock in their original order. Compress only consecutive internal stage advances into one readiness-confirmation row naming exactly the parts checked; never claim every part was checked on a partial advance.
- Count business decisions independently of stage moves. Replace stage arrows and transition jargon in chat, sheet header, footer and lock dialog with pending/saved business outcomes. Keep the full backend proposal and all transaction/permission/readiness checks unchanged.
- Reuse the same public overlay/table/grouped primitives. Preserve package detail disclosures and pagination over visible review rows.
- Verify grouping/immutability and actual component lock/cancel/stale/double-click behavior, then inspect desktop/mobile in dev Browser. Record the new copy in the existing design rule and refresh graph.

## Verification

- A five-step finalization example now shows two business decisions and one summarized readiness check. All Ready package/scope/final-lock rows retain their order, while consecutive stage transitions name only the parts actually checked. The full server proposal and confirmation payload are unchanged.
- Grouping tests verify non-mutation and scope decisions between transition groups; the actual component test confirms explicit lock/cancel/double-click/stale guards. Three tests pass, scoped ESLint and web production build pass.
- Dev Browser at 320/360/390/430/1024/1280/1440px has no horizontal overflow or old “Lanjut ke” copy. Evidence: `output/ai-chat-qa/rap-finalization-copy/desktop-1280.png`, `mobile-390.png`. No business save was performed.
- The existing DESIGN.md rule and design sidecar now match the refined copy exactly. Finish review reports ship with no remaining material findings; formatting passes and the context graph has been refreshed.
