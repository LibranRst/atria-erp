import { z } from "zod";
import { updateOwnProfileSchema } from "../validations/profile";
export const OWN_PROFILE_KIND = "OWN_PROFILE";
export const ownProfilePhotoSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("KEEP") }).strict(),
  z.object({ action: z.literal("REMOVE") }).strict(),
  z.object({ action: z.literal("REPLACE"), attachmentId: z.string().guid() }).strict(),
]);
export const ownProfileInputSchema = z
  .object({
    name: updateOwnProfileSchema.shape.name.optional(),
    photo: ownProfilePhotoSchema.default({ action: "KEEP" }),
  })
  .strict()
  .refine(
    (input) => input.name !== undefined || input.photo.action !== "KEEP",
    "Sebutkan nama atau perubahan foto.",
  );
const publicImage = updateOwnProfileSchema.shape.imageUrl.unwrap();
export const ownProfileSnapshotSchema = z
  .object({ name: z.string().max(255), imageUrl: publicImage, hasPhoto: z.boolean() })
  .strict();
const attachmentImage = z
  .object({
    id: z.string().guid(),
    fileName: z.string().max(255),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
  })
  .strict();
export const ownProfileProposalSchema = z
  .object({
    kind: z.literal(OWN_PROFILE_KIND),
    input: ownProfileInputSchema,
    expectedContext: z.string().length(64),
    before: ownProfileSnapshotSchema,
    after: ownProfileSnapshotSchema,
    photoSource: attachmentImage.nullable(),
    changedFields: z.array(z.enum(["name", "photo"])).max(2),
  })
  .strict();
export const ownProfileIdentitySchema = z
  .object({ conversationId: z.string().guid(), toolCallId: z.string().min(1).max(200) })
  .strict();
export type OwnProfileInput = z.infer<typeof ownProfileInputSchema>;
export type OwnProfileProposal = z.infer<typeof ownProfileProposalSchema>;
export type OwnProfileSnapshot = z.infer<typeof ownProfileSnapshotSchema>;
export type OwnProfileView = {
  readonly proposal: OwnProfileProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly current: OwnProfileSnapshot;
  readonly saved: OwnProfileSnapshot | null;
  readonly verified: boolean;
  readonly confirmedAt: string | null;
};
