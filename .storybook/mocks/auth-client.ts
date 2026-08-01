/**
 * Storybook-only stand-in for @/lib/auth-client. Real client hits Better Auth's
 * network endpoints; stories need a deterministic, network-free session shape.
 * Aliased in .storybook/main.ts — never imported by app code.
 */
export const authClient = {
  useSession(): { readonly data: null; readonly isPending: false } {
    return { data: null, isPending: false };
  },
};
