import { describe, expect, test } from "bun:test";
import { generateSecureTemporaryPassword } from "./temporary-password";
import { passwordPolicySchema } from "../validations/administration";

describe("generateSecureTemporaryPassword", () => {
  test("menghasilkan password yang valid terhadap passwordPolicySchema", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generateSecureTemporaryPassword();
      const result = passwordPolicySchema.safeParse(pwd);
      expect(result.success).toBe(true);
      expect(pwd.length).toBeGreaterThanOrEqual(14);
      expect(pwd).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[0-9]/);
    }
  });
});
