-- Desktop is a presentation capability, independent of domain rights and scope.
-- Only system Owner and Finance Admin receive the initial grant. Custom roles
-- can be granted it explicitly through Settings. This forward migration runs
-- once, so a later revocation is never restored by application startup.
INSERT INTO "role_permission" ("role_id", "permission_key")
SELECT "id", 'use:desktop_admin'
FROM "role"
WHERE "id" IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
