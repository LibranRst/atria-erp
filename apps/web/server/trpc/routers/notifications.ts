import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure } from "@/server/trpc/procedures";
import {
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/server/usecases/notifications/notification-queries";
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "@atria/core/notifications/types";

export const notificationsRouter = createTRPCRouter({
  registerPush: activeProcedure
    .input(registerPushTokenSchema)
    .mutation(({ ctx, input }) =>
      registerPushSubscription(input, ctx.actor!.userId, ctx.actor!.sessionId),
    ),
  unregisterPush: activeProcedure
    .input(unregisterPushTokenSchema)
    .mutation(({ ctx, input }) => unregisterPushSubscription(input, ctx.actor!.userId)),
});
