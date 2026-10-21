-- Built-in roles retain stable IDs even when their display names use lowercase.
-- Grant chat entry only; material/finance permissions and data scope are untouched.
INSERT INTO "role_permission" ("role_id", "permission_key")
SELECT "id", 'use:ai_chat' FROM "role"
WHERE "id" = '00000000-0000-0000-0000-000000000004'
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
