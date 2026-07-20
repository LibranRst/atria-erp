# Atria UI/UX Skill and Agent Governance Plan

## Goal

Create `atria-ui-ux` as the mandatory repository skill for every Atria UI/UX implementation or review, retire `ios26-ui-motion`, and remove the repository's dependency on legacy plugin naming or instructions without changing application UI behavior.

## Implementation

- Create the canonical skill under `.agents/skills/atria-ui-ux` with Codex metadata, a live-code visual catalog, form guidance, motion allow/deny rules, and proportional mobile verification.
- Add a Claude project-skill adapter while keeping `.agents/skills` canonical for Codex, Antigravity, and compatible agents.
- Update `AGENTS.md`, `CLAUDE.md`, active design documentation, and motion utility comments so UI work must load the new skill and page/tab content transitions remain instant.
- Move the legacy plan and spec directories to `docs/plans` and `docs/specs`, preserving tracked and untracked content and rewriting repository references.
- Remove obsolete plugin directives and ignore rules.

## Validation

- Validate the skill with `quick_validate.py` and verify `agents/openai.yaml`.
- Compare documentation manifests and checksums before and after the move.
- Verify the Claude adapter resolves to the canonical skill.
- Confirm no source-repository reference to the retired plugin remains.
- Forward-test the skill with non-mutating UI planning and review scenarios.

## Constraints

- Preserve all unrelated dirty-worktree changes.
- Do not modify current application UI behavior or styling.
- Keep tab content changes instant; only the active segmented-tab pill may animate.
