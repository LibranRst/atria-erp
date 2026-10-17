"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrentUserProfile, usePermission } from "@/components/auth/permissions-provider";
import { Button, ConfirmationDialog, DesktopButton } from "@/components/ui";
import { workspaceHref, type WorkspacePresentation } from "@/lib/navigation/workspace-routes";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { saveWorkspacePreference } from "./workspace-preference";

export function WorkspaceSwitch({
  target,
}: {
  readonly target: WorkspacePresentation;
}): React.JSX.Element | null {
  const presentation = useWorkspacePresentation();
  const allowed = usePermission("use:desktop_admin");
  const user = useCurrentUserProfile();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (!allowed || presentation === target) return null;
  const label = target === "desktop" ? "Buka desktop admin" : "Tampilan ringkas";
  function switchSurface(): void {
    saveWorkspacePreference(user?.id, target);
    const href = `${pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
    setConfirm(false);
    router.push(workspaceHref(href, target));
  }
  return (
    <>
      {presentation === "desktop" ? (
        <DesktopButton variant="secondary" onPress={() => setConfirm(true)}>
          {label}
        </DesktopButton>
      ) : (
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          {label}
        </Button>
      )}
      <ConfirmationDialog
        open={confirm}
        title="Ganti tampilan?"
        description="Simpan perubahan atau tutup formulir yang masih terbuka sebelum berpindah tampilan. Halaman dan filter yang sama akan dibuka."
        onClose={() => setConfirm(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirm(false)}>
              Tetap di sini
            </Button>
            <Button fullWidth onClick={switchSurface}>
              Ganti tampilan
            </Button>
          </div>
        }
      />
    </>
  );
}
