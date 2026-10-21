import { expect, mock } from "bun:test";

mock.module("server-only", () => ({}));

let temporary = true;
const calls: { readonly operation: string; readonly args: readonly unknown[] }[] = [];
mock.module("@/lib/auth/server", () => ({
  requireAdminActor: async (): Promise<{
    readonly mustChangePassword: boolean;
    readonly developerActorUserId: null;
  }> => ({
    mustChangePassword: temporary,
    developerActorUserId: null,
  }),
}));
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (
    operation: string,
    args: readonly unknown[],
  ): Promise<{ readonly success: true; readonly data: { readonly changed: true } }> => {
    calls.push({ operation, args });
    return { success: true, data: { changed: true } };
  },
}));

const { changePassword } = await import("../actions");
const input = { currentPassword: "Old-Password123", newPassword: "New-Password456" };
expect(await changePassword(input)).toEqual({ success: true, requiresLogin: true });
expect(calls[0]).toEqual({
  operation: "app/actions/administration-staff.changeTemporaryPassword",
  args: [input],
});

temporary = false;
expect(await changePassword(input)).toEqual({ success: true, requiresLogin: false });
expect(calls[1]).toEqual({
  operation: "app/actions/profile/change-own-password.changeOwnPassword",
  args: [input],
});

const invalid = await changePassword({
  currentPassword: input.currentPassword,
  newPassword: "short",
});
expect(invalid.success).toBe(false);
expect(calls).toHaveLength(2);

const equal = await changePassword({
  currentPassword: input.currentPassword,
  newPassword: input.currentPassword,
});
expect(equal.success).toBe(false);
expect(calls).toHaveLength(2);
console.log("password-actions: passed");
