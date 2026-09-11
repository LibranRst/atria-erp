import { resolveStaticRoleName } from "@atria/core/auth/permissions";
import { createContext, useCallback, useContext, useMemo } from "react";

import { authClient } from "@/lib/auth-client";
import { clearStoredPushToken, readStoredPushToken } from "@/lib/push-token-storage";
import { trpcClient } from "@/lib/trpc-client";

export type MobileSessionUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roleId: string | null;
  readonly mustChangePassword: boolean;
};

type AuthContextValue = {
  readonly errorMessage: string | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly refresh: () => Promise<void>;
  readonly roleName: string | null;
  readonly signOut: () => Promise<void>;
  readonly user: MobileSessionUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function readSessionUser(session: unknown): MobileSessionUser | null {
  if (!isRecord(session) || !isRecord(session.user)) return null;

  const id = readString(session.user, "id");
  const name = readString(session.user, "name");
  const email = readString(session.user, "email");
  if (!id || !name || !email) return null;

  return {
    id,
    name,
    email,
    roleId: readString(session.user, "roleId"),
    mustChangePassword: session.user.mustChangePassword === true,
  };
}

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const session = authClient.useSession();
  const user = readSessionUser(session.data);
  const roleName = user?.roleId ? (resolveStaticRoleName(user.roleId) ?? null) : null;

  const refresh = useCallback(async (): Promise<void> => {
    await session.refetch();
  }, [session]);

  const signOut = useCallback(async (): Promise<void> => {
    // Setelah ganti kata sandi sementara, server sudah menghapus seluruh sesi,
    // sehingga panggilan sign-out ini akan ditolak. Kegagalannya diabaikan
    // dengan sengaja: token lokal tetap harus dibuang dan sesi tetap harus
    // di-refetch supaya gate kembali ke layar login.
    const push = await readStoredPushToken().catch(() => null);
    if (push) {
      await trpcClient.notifications.unregisterPush.mutate(push).catch(() => undefined);
    }
    await clearStoredPushToken().catch(() => undefined);
    await authClient.signOut().catch(() => undefined);
    await session.refetch();
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      errorMessage: session.error?.message ?? null,
      isAuthenticated: user !== null,
      isLoading: session.isPending,
      refresh,
      roleName,
      signOut,
      user,
    }),
    [refresh, roleName, session.error?.message, session.isPending, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth wajib dipakai di dalam AuthProvider.");
  return value;
}
