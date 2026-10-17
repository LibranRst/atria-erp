# Dedicated development Owner access on public Paduna

## Authorized scope

The user requested a dedicated development account on the public Paduna instance, with Owner role, and explicitly excluded changes to Raden Indra's account. Create `dev-owner@paduna.test` (Paduna Dev Owner) only if that email is unused. The reserved test address is a login identifier and does not send mail.

## Execution and guards

- Use the existing production project `polished-glade-93740595`, branch `br-lucky-heart-b3qmgl34`, database `atria_pilot`, with an exact endpoint/database guard.
- Reuse the existing instance tenant, Owner role and permission grants. Do not seed, migrate, change role grants or modify any existing user, password, session, project, stock or finance row.
- Generate a unique strong temporary password through the installed Better Auth password hasher and validate the shared staff input contract.
- In one Drizzle transaction, lock the administration tenant, confirm the exact role/email, create the user, credential and tenant membership, and record a password-free operator audit entry. Follow the existing mandatory first-login password-change contract.
- Verify the new identity and unchanged existing Owner metadata with read-only checks, then sign in at the public Paduna origin. Hand the personal-password step to the user; do not fill or submit a replacement personal password.
- Keep connection credentials and the temporary password out of source, documentation, screenshots and committed evidence. Deliver the requested login password directly to the user.

## Acceptance

The dedicated account authenticates on the public domain and reaches the existing password-change gate. Existing Owner and business records remain unchanged; the user receives the email and temporary password.

## Executed result

- Created Paduna Dev Owner (`dev-owner@paduna.test`), ID `7c524a0a-cea5-40ca-b837-ce913d72bd9c`, in the verified production database. Reused the existing active tenant and global Owner role (71 existing permission grants).
- Exactly one credential, active membership and password-free `OPERATOR_CREATE_DEV_OWNER` audit accompany the account. Shared staff validation and installed Better Auth hashing/verification passed.
- All five existing users and their credential metadata remain identical; Raden Indra's session set is unchanged. No existing account, grant or business row was updated or deleted.
- Public browser sign-in succeeded and reached `/profile/password`. Read-only verification confirms one authenticated session, Owner role, active membership and the required personal-password gate. The user must complete that final credential change personally.
- Sanitized evidence: `output/qa/production-dev-owner-2026-10-18/creation-evidence.json` and `public-login-password-gate.png`. Temporary connection and operator files were removed after execution. No application implementation or deployment change was required.
