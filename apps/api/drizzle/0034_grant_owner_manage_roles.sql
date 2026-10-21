-- Perbaikan maju untuk `0033_add_role_permission.sql`.
--
-- Daftar seed di migrasi itu memuat 69 dari 70 izin Owner: `manage:roles`
-- terlewat. Akibatnya justru pada kunci yang paling penting — setelah 0033
-- berjalan, peran Owner punya baris di `role_permission`, sehingga cadangan ke
-- matriks kode tidak lagi berlaku dan layar "Peran & akses" tertutup untuk
-- semua orang, termasuk Owner.
--
-- 0033 sudah tercatat di `__drizzle_migrations`, jadi ia tidak boleh disunting;
-- kekurangannya ditambal maju di sini.
INSERT INTO "role_permission" ("role_id", "permission_key")
VALUES ('00000000-0000-0000-0000-000000000001', 'manage:roles')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
