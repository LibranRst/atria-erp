import { expect, test } from "bun:test";
import {
  ownProfileInputSchema,
  ownProfileIdentitySchema,
  ownProfileProposalSchema,
} from "./own-profile";
const id = "11111111-1111-4111-8111-111111111111";
test("own profile excludes target users, credentials, roles and arbitrary photo URLs", () => {
  for (const input of [
    { name: "Budi", userId: id },
    { name: "Budi", email: "x@example.com" },
    { name: "Budi", roleId: id },
    { name: "Budi", password: "secret" },
    { photo: { action: "REPLACE", url: "https://example.com/a.jpg" } },
  ])
    expect(ownProfileInputSchema.safeParse(input).success).toBe(false);
  expect(
    ownProfileIdentitySchema.safeParse({ conversationId: id, toolCallId: "call", name: "Tampered" })
      .success,
  ).toBe(false);
});
test("preserving and removing a photo remain distinct from selecting an owned attachment", () => {
  expect(ownProfileInputSchema.parse({ name: "  Budi Santoso  " })).toEqual({
    name: "Budi Santoso",
    photo: { action: "KEEP" },
  });
  expect(ownProfileInputSchema.parse({ photo: { action: "REMOVE" } })).toEqual({
    photo: { action: "REMOVE" },
  });
  expect(ownProfileInputSchema.parse({ photo: { action: "REPLACE", attachmentId: id } })).toEqual({
    photo: { action: "REPLACE", attachmentId: id },
  });
  expect(ownProfileInputSchema.safeParse({}).success).toBe(false);
});
test("name boundaries and photo metadata cannot bypass the manual profile contract", () => {
  expect(ownProfileInputSchema.safeParse({ name: " " }).success).toBe(false);
  expect(ownProfileInputSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
  const p = {
    kind: "OWN_PROFILE",
    input: { name: "Budi" },
    expectedContext: "a".repeat(64),
    before: { name: "Lama", imageUrl: null, hasPhoto: false },
    after: { name: "Budi", imageUrl: null, hasPhoto: false },
    photoSource: null,
    changedFields: ["name"],
  };
  expect(ownProfileProposalSchema.safeParse(p).success).toBe(true);
  expect(
    ownProfileProposalSchema.safeParse({
      ...p,
      before: { name: "Lama", imageUrl: "https://evil.example/tracking", hasPhoto: true },
    }).success,
  ).toBe(false);
  expect(
    ownProfileProposalSchema.safeParse({
      ...p,
      photoSource: { id, fileName: "x.png", mimeType: "image/png", size: 9 * 1024 * 1024 },
    }).success,
  ).toBe(false);
});
