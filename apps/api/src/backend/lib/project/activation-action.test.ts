import { withTestRequest } from "@backend/lib/testing/request";
import { afterEach, expect, test } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { and, eq } from "drizzle-orm";

import { activateProjectAction } from "@backend/app/actions/project/activation";
import { db } from "@backend/db";
import { auditLog, project } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";

const PROJECT_ID = "77777777-7777-7777-7777-777777777771";
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

describeIntegration("project activation action", () => {
  // Hook ini menyentuh Postgres, jadi ia harus ikut tergerbang bersama suite-nya
  // dan tidak boleh berada di scope modul.
  afterEach(
    withTestRequest(async () => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
      await db.update(project).set({ status: "ACTIVE" }).where(eq(project.id, PROJECT_ID));
      await db
        .delete(auditLog)
        .where(and(eq(auditLog.action, "ACTIVATE_PROJECT"), eq(auditLog.targetId, PROJECT_ID)));
    }),
  );

  test(
    "activates a ready Draft project only after rechecking the safeguards",
    withTestRequest(async () => {
      (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
        user: {
          id: "11111111-1111-1111-1111-111111111111",
          roleId: "00000000-0000-0000-0000-000000000001",
        },
      });
      await db.update(project).set({ status: "DRAFT" }).where(eq(project.id, PROJECT_ID));

      const result = await activateProjectAction({ projectId: PROJECT_ID });

      if (!result.success) throw new Error(result.error.message);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("ACTIVE");
      const activated = await db.query.project.findFirst({
        where: eq(project.id, PROJECT_ID),
      });
      expect(activated?.status).toBe("ACTIVE");
    }),
  );
});
