import { z } from "zod";

import { ACTIVITY_DETAIL_KINDS } from "./types";

const databaseUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "ID aktivitas tidak valid.",
  );

export const activityDetailRequestSchema = z.object({
  kind: z.enum(ACTIVITY_DETAIL_KINDS),
  id: databaseUuidSchema,
});
