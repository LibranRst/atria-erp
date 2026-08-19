import { describe, expect, test } from "bun:test";

import { bootstrapOwnerSchema, createStaffUserSchema } from "./administration";

/**
 * Kredensial yang ditulis `docs/guide/financial_workflow_guide.md` bagian 2.
 *
 * Panduan itu menyuruh pembacanya mengetik password ini di `/setup` sebagai
 * langkah pertama UAT. Kalau aturan password diperketat — misalnya menuntut
 * simbol — password yang terdokumentasi diam-diam menjadi tidak sah, dan
 * pembaca terjebak di langkah A0 tanpa tahu bahwa panduannya yang usang.
 * Test ini mengikat dokumen itu pada aturan yang sebenarnya berlaku.
 */
const UAT_PASSWORD = "Dekoria123456";
const UAT_EMAILS = [
  "owner@dekoria.test",
  "finance@dekoria.test",
  "pm@dekoria.test",
  "purchasing@dekoria.test",
] as const;

describe("kredensial UAT yang terdokumentasi", () => {
  test("password panduan diterima saat bootstrap Owner", () => {
    const result = bootstrapOwnerSchema.safeParse({
      bootstrapSecret: "x".repeat(16),
      name: "Owner UAT Dekoria",
      email: UAT_EMAILS[0],
      password: UAT_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  test.each(UAT_EMAILS.slice(1))("password panduan diterima untuk akun staff %s", (email) => {
    const result = createStaffUserSchema.safeParse({
      name: "Staff UAT",
      email,
      roleId: "00000000-0000-0000-0000-000000000002",
      temporaryPassword: UAT_PASSWORD,
    });
    expect(result.success).toBe(true);
  });
});
