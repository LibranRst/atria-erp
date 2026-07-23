# Atria Control Language: Buttons, Badges, and Tokens

## Objective

Standardize every active user-facing action and status treatment without changing finance, material, RBAC, or navigation behavior. The implementation introduces shared controls, removes un-tokened semantic color usage, and records deliberate exceptions.

## Delivery Order

1. Define semantic color tokens, control primitives, status presentation, and sheet footer behavior.
2. Migrate shared form/sheet controls and all active domain call sites by control role.
3. Record the audit matrix in `docs/05-ui-ux/CONTROL_LANGUAGE.md` and enforce the no-raw-semantic-color policy in tests.
4. Verify component contracts, lint, build, and mobile widths 320/360/390/430.

## Non-Negotiable Rules

- Primary commits are black; accent blue is interaction, focus, selection, and tertiary navigation only.
- Section-header navigation uses the shared compact light-blue `SectionAction` capsule, never bare action text.
- A sheet with one action uses a full-width primary footer action. When a safe secondary action is present, the two actions render as equal secondary + primary columns. Header actions never commit data.
- Solid critical actions occur only in an irreversible confirmation. A quiet critical action opens that confirmation or marks a risky branch.
- Status badges use semantic presentation and user-facing Bahasa Indonesia labels. Counts, metadata, tabs, filters, and option choices are separate control types.
- Configured bank-card gradients and inverse focal surfaces are identity/surface exceptions, not semantic-status colors.

## Follow-up: Complete Pill Migration

The initial rollout left local status/count/metadata pill recipes in several active domains. This follow-up migrates every non-interactive pill with badge semantics to `StatusBadge`, `CountBadge`, or `MetadataChip`; capsule buttons, filters, tabs, option choices, avatar/initial markers, icon containers, and identity-surface labels remain purpose-built controls.

Motion: no new motion; existing interactive-control feedback remains unchanged.
