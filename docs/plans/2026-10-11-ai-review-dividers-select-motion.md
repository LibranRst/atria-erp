# Review separators and select popup motion

Match review row/form separators with the existing manual FormSection separator (`outline-variant/20`), retaining the lighter ring token for surface outlines. Apply this to shared review/form boundaries and AI-owned divided fact groups; do not change finance calculations or data.

Select dropdowns currently animate inner content while Dashboard dropdowns animate their full popover. Use the existing Dashboard popover motion for the full Select.Popover, including close, while keeping React Aria's option collection mounted when closed. Retain exiting surfaces only through the shared Framer transition, cancel stale exits on reopening, preserve keyboard/dismissal layering and honor reduced motion. Plain, searchable and filter selects share the same lifecycle; mobile selection dialogs retain their established presentation.

Verify manual/review divider color parity, repeated popup open/close, selected label stability, keyboard selection and Escape without closing the parent sheet, search and disabled choices. Use visible @Browser and the required viewport matrix; no business saves. Run shared DOM tests, web gates/style checks and refresh the graph.

## Completion

Implemented shared manual-form separators in ReviewCollection, embedded FormSection and AI divided groups. Plain, searchable and filter selectors now animate the actual popover surface with shared Dashboard states; exit/reopen guards preserve the collection and queued create actions wait for focus restoration. Search results remain stable during exit and reset afterward.

Verified in the visible dev app: selected labels, all category options, Enter selection, Escape without closing the parent, repeat opening, and draft/editor/selection retention without horizontal overflow at 320/360/390/430/1024/1280/1440 px. The shared DOM fixture also checks create-action focus after exit. All 985 web tests, web build, workspace lint (zero errors; one existing Material Master dependency warning) and HeroUI style check passed. No business records were submitted. Evidence: `output/ai-chat-qa/expense-batch-workflow/ux-consistency/dividers-motion/`.
