# Main Page Audit — 13 July 2026

## Findings

| Surface             | Assessment                                                                                            | Direction                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Dashboard           | Strong financial anchor, but detail tabs overflow and stored health can contradict actual risk.       | Preserve pulse and navigation; rank actions and show derived risk. |
| Projects            | Search/filter works, but image-heavy cards prevent fast portfolio comparison.                         | Replace with compact project rows.                                 |
| Project Detail      | RAB/RAP content is useful; the large identity hero and wrapping financial values dominate the screen. | Compact identity strip and one readable health summary.            |
| Finance Inbox       | Workflow is clear, but draft cards and metrics delay the actionable queue.                            | Collapse drafts and move the work queue above the fold.            |
| Approvals           | Long repeated cards make a decision inbox difficult to scan.                                          | Queue-first rows with detail/decision disclosure.                  |
| Materials           | Inventory context is good; Overview duplicates every FAB operation.                                   | Use the Overview for stock pulse, attention, and recent activity.  |
| Settings            | Correct source-of-truth mental model and restrained visual language.                                  | Light density and tab polish only.                                 |
| Profile             | Clear account and access summary.                                                                     | Light typography and long-text polish only.                        |
| Login / AI Analysis | Functional but carries older pulse/shadow treatments.                                                 | Calm motion and shared feedback polish.                            |

## Cross-Surface Gaps

- No route-level loading/error boundaries exist on the operational routes.
- Filtered empty states exist in only a subset of list surfaces.
- Several fixed-shell components still contain viewport breakpoints.
- CSS animation utilities remain in touched UI despite the unified Framer Motion rule.
- Horizontal tab strips do not auto-reveal the active item or clearly signal overflow.

## Preserved Foundations

- Fixed top bar and morphing header menu.
- Bottom tab bar and contextual plus button.
- Mobile-first `max-w-md` shell.
- Existing RAB/RAP workflows, finance actions, RBAC, project scoping, and stock mutations.
- Monochrome-first palette with teal/warning/error used semantically.
