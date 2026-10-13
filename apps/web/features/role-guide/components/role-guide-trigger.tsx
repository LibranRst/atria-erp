"use client";

import { AppIcon, Button } from "@/components/ui";
import { useRoleGuide } from "./role-guide-provider";

export function RoleGuideTrigger(): React.JSX.Element | null {
  const guide = useRoleGuide();
  if (!guide) return null;
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        fullWidth
        pending={guide.loading}
        pendingLabel="Memuat panduan…"
        onClick={guide.openGuide}
        className="justify-between text-left"
        leadingIcon={<AppIcon name="verified_user" className="icon-md" />}
        trailingIcon={<AppIcon name="chevron_right" className="icon-md" />}
      >
        Panduan peran saya
      </Button>
      {guide.error ? (
        <p role="status" className="px-1 text-row text-on-surface-variant">
          {guide.error}
        </p>
      ) : null}
    </div>
  );
}
