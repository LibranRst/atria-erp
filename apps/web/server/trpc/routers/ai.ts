import "server-only";

import { z } from "zod";

import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure } from "@/server/trpc/procedures";
import { processReceiptUseCase } from "@/server/usecases/ai/process-receipt";

const processReceiptInput = z.object({
  receiptImageUrl: z.string().min(1, "URL gambar nota wajib disediakan."),
});

/** Operasi AI yang aman dipakai klien native. */
export const aiRouter = createTRPCRouter({
  processReceipt: activeProcedure
    .meta({ permission: "create:cost" })
    .input(processReceiptInput)
    .mutation(({ ctx, input }) => processReceiptUseCase(ctx.actor!, input.receiptImageUrl)),
});
