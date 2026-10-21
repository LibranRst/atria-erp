"use client";

import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { AppIcon } from "./ui";
import { authClient } from "@/lib/auth-client";
import { useGuardedLeaveAction } from "./unsaved-changes";

export function LogoutButton(): React.JSX.Element {
  const requestLeave = useGuardedLeaveAction();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut(leaveDocument: (href: string) => void): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Belum bisa keluar. Coba lagi.");
        return;
      }
      leaveDocument("/login");
    } catch {
      setError("Server tidak dapat dijangkau. Coba lagi.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        variant="tertiary"
        size="sm"
        isPending={pending}
        onPress={(): void => {
          requestLeave(signOut);
        }}
      >
        {pending ? (
          <Spinner size="sm" color="current" />
        ) : (
          <AppIcon name="logout" size={16} aria-hidden="true" />
        )}
        Keluar
      </Button>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
