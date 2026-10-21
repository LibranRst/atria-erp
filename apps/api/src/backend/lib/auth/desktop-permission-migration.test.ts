import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "bun:test";

test("desktop migration only adds default system grants and preserves customized scope/permissions", async () => {
  const client = new PGlite();
  try {
    await client.exec(`
      CREATE TABLE role (id uuid PRIMARY KEY, data_scope text NOT NULL);
      CREATE TABLE role_permission (
        role_id uuid NOT NULL REFERENCES role(id), permission_key varchar(64) NOT NULL,
        UNIQUE (role_id, permission_key)
      );
      INSERT INTO role VALUES
        ('00000000-0000-0000-0000-000000000001', 'GLOBAL'),
        ('00000000-0000-0000-0000-000000000002', 'ASSIGNED'),
        ('00000000-0000-0000-0000-000000000003', 'ASSIGNED'),
        ('00000000-0000-0000-0000-000000000004', 'NONE'),
        ('00000000-0000-0000-0000-000000000005', 'ASSIGNED');
      INSERT INTO role_permission VALUES
        ('00000000-0000-0000-0000-000000000001', 'manage:roles'),
        ('00000000-0000-0000-0000-000000000002', 'view:cost'),
        ('00000000-0000-0000-0000-000000000005', 'view:project');
    `);
    const migration = await Bun.file(
      new URL("../../../../drizzle/0042_grant_desktop_admin.sql", import.meta.url),
    ).text();
    await client.exec(migration);
    await client.exec(migration);
    const { rows } = await client.query<{ role_id: string; permission_key: string }>(
      "SELECT role_id, permission_key FROM role_permission ORDER BY role_id, permission_key",
    );
    expect(rows).toEqual([
      { role_id: "00000000-0000-0000-0000-000000000001", permission_key: "manage:roles" },
      { role_id: "00000000-0000-0000-0000-000000000001", permission_key: "use:desktop_admin" },
      { role_id: "00000000-0000-0000-0000-000000000002", permission_key: "use:desktop_admin" },
      { role_id: "00000000-0000-0000-0000-000000000002", permission_key: "view:cost" },
      { role_id: "00000000-0000-0000-0000-000000000005", permission_key: "view:project" },
    ]);
    const scopes = await client.query<{ data_scope: string }>(
      "SELECT data_scope FROM role ORDER BY id",
    );
    expect(scopes.rows.map((row) => row.data_scope)).toEqual([
      "GLOBAL",
      "ASSIGNED",
      "ASSIGNED",
      "NONE",
      "ASSIGNED",
    ]);
  } finally {
    await client.close();
  }
}, 20_000);
