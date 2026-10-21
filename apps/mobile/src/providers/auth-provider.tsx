import type { PermissionKey } from "@atria/core/auth/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { clearStoredPushToken, readStoredPushToken } from "@/lib/push-token-storage";
import { trpcClient } from "@/lib/trpc-client";
import { isAccessRevoked } from "@/lib/access-error";
import { createAuthCacheScope } from "@/lib/auth-cache-scope";

const NO_PERMISSIONS: readonly PermissionKey[] = [];

export type MobileSessionUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  readonly roleId: string | null;
  readonly mustChangePassword: boolean;
};

type AuthContextValue = {
  readonly cacheScope: string;
  readonly accessError: string | null;
  readonly errorMessage: string | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly refresh: () => Promise<void>;
  readonly roleName: string | null;
  readonly permissions: readonly PermissionKey[];
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
    image: readString(session.user, "image"),
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
  const queryClient = useQueryClient();
  const user = useMemo(() => readSessionUser(session.data), [session.data]);
  const accessEnabled = user !== null && !user.mustChangePassword;
  const capabilities = useQuery({
    enabled: accessEnabled,
    queryKey: ["auth", "capabilities", user?.id, user?.roleId, session.data?.session.id],
    queryFn: () => trpcClient.screen.capabilities.query(),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const revoked = isAccessRevoked(capabilities.error);
  const roleName = accessEnabled && !revoked ? (capabilities.data?.roleName ?? null) : null;
  const permissions =
    accessEnabled && !revoked ? (capabilities.data?.permissions ?? NO_PERMISSIONS) : NO_PERMISSIONS;
  const cacheScope = createAuthCacheScope({
    userId: user?.id,
    sessionId: session.data?.session.id,
    roleId: user?.roleId,
    permissions,
    dataScope: accessEnabled && !revoked ? (capabilities.data?.dataScope ?? null) : null,
  });
  const previousScope = useRef(cacheScope);
  useEffect(() => {
    const previous = previousScope.current;
    previousScope.current = cacheScope;
    if (previous === cacheScope) return;
    const predicate = (query: { readonly queryKey: readonly unknown[] }): boolean =>
      query.queryKey.at(-1) === previous;
    void queryClient
      .cancelQueries({ predicate })
      .then(() => queryClient.removeQueries({ predicate }));
  }, [cacheScope, queryClient]);

  const refresh = useCallback(async (): Promise<void> => {
    await session.refetch();
    if (accessEnabled) await capabilities.refetch();
  }, [accessEnabled, capabilities, session]);

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
    queryClient.clear();
    await session.refetch();
  }, [queryClient, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      cacheScope,
      accessError: revoked
        ? "Akses akun berubah atau sesi berakhir. Masuk ulang untuk melanjutkan."
        : accessEnabled && capabilities.data === undefined
          ? capabilities.fetchStatus === "paused"
            ? "Hubungkan perangkat ke internet untuk memeriksa akses akun."
            : capabilities.error
              ? "Akses akun belum dapat dimuat. Coba lagi atau masuk ulang."
              : null
          : null,
      errorMessage: session.error?.message ?? null,
      isAuthenticated: user !== null,
      isLoading: session.isPending || (accessEnabled && capabilities.isLoading),
      refresh,
      roleName,
      permissions,
      signOut,
      user,
    }),
    [
      accessEnabled,
      cacheScope,
      capabilities.data,
      capabilities.error,
      capabilities.fetchStatus,
      capabilities.isLoading,
      revoked,
      permissions,
      refresh,
      roleName,
      session.error?.message,
      session.isPending,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth wajib dipakai di dalam AuthProvider.");
  return value;
}
