"use client";

import { usePermissions } from "@/components/auth/permissions-provider";
import { ActionMenu, AppIcon, DesktopButton, type ActionMenuItem } from "@/components/ui";
import { useProjectState } from "@/features/projects/detail/components/shared/project-state-context";
import { buildFabActions, type FabAction } from "@atria/core/navigation/quick-actions";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation/workspace-navigation";

const stockPermissions: Readonly<Record<string, PermissionKey>> = {
  RECEIVE: "create:stock_movement",
  RESERVE: "reserve:stock",
  USE: "use:stock",
  RETURN: "create:stock_movement",
  WASTE: "waste:stock",
  TRANSFER: "transfer:stock",
  COUNT: "create:stock_count",
  ADJUST: "adjust:stock",
  LOCATION: "create:stock_movement",
};

export function AdminQuickActions(): React.JSX.Element | null {
  const permissions = usePermissions();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const project = useProjectState();
  const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname);
  const actions = buildFabActions({
    permissions,
    pathname,
    isProjectDetail,
    isCurrentProjectLocked: isProjectDetail && project.isLocked,
    withQuery: (key, value = "true", target = pathname): string => {
      const query =
        target === pathname ? new URLSearchParams(params.toString()) : new URLSearchParams();
      query.set(key, value);
      return `${target}?${query.toString()}`;
    },
  }).filter((action): boolean => {
    const query = new URL(action.href, "https://atria.invalid").searchParams;
    if (query.has("new-expense")) return permissions.includes("create:cost");
    if (query.has("new-vendor-bill")) return permissions.includes("create:vendor_bill");
    if (query.has("new-invoice")) return permissions.includes("create:client_invoice");
    const stockAction = query.get("action");
    return (
      !stockAction ||
      !stockPermissions[stockAction] ||
      permissions.includes(stockPermissions[stockAction])
    );
  });
  if (!actions.length) return null;
  const controls = new Set(["LOCATION", "TRANSFER", "COUNT", "ADJUST"]);
  const groups: readonly { readonly label: string; readonly actions: readonly FabAction[] }[] = [
    { label: "Tambah", actions },
  ];
  const stockPage =
    pathname.startsWith("/materials") &&
    actions.some((action) =>
      new URL(action.href, "https://atria.invalid").searchParams.has("action"),
    );
  const operationalGroups = stockPage
    ? [
        {
          label: "Pergerakan stok",
          actions: actions.filter(
            (action) =>
              !controls.has(
                new URL(action.href, "https://atria.invalid").searchParams.get("action") ?? "",
              ),
          ),
        },
        {
          label: "Kontrol stok",
          actions: actions.filter((action) =>
            controls.has(
              new URL(action.href, "https://atria.invalid").searchParams.get("action") ?? "",
            ),
          ),
        },
      ]
    : groups;
  return (
    <>
      {operationalGroups
        .filter((group) => group.actions.length > 0)
        .map((group) => {
          const items: readonly ActionMenuItem[] = group.actions.map((action) => ({
            id: action.href,
            label: action.label,
            icon: action.iconName,
            disabledReason: action.disabled ? action.description : undefined,
            onSelect: (): void => router.push(action.href),
          }));
          return (
            <ActionMenu
              key={group.label}
              label={group.label}
              trigger={
                <DesktopButton>
                  <AppIcon name="add" className="icon-md" />
                  {group.label}
                </DesktopButton>
              }
              items={items}
            />
          );
        })}
    </>
  );
}
