import { useQueryClient } from "@tanstack/react-query";
import { useNavigationContainerRef, usePathname, useRouter } from "expo-router";
import { StackActions } from "expo-router/react-navigation";
import { useMainNavigation } from "@/providers/main-navigation-provider";
import { useAuth } from "@/providers/auth-provider";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { resolveAppDestination } from "./app-destination";
import { getWebBaseURL } from "./runtime-config";
import { workspaceStackToRestore } from "./main-navigation-state";

export function useAtriaNavigation(): (destination: string, preferWeb?: boolean) => void {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const main = useMainNavigation();
  const { refresh: refreshAuth } = useAuth();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);
  const queryClient = useQueryClient();
  return useCallback(
    (destination: string, preferWeb = false): void => {
      const target = resolveAppDestination(destination, preferWeb);
      if (!target) {
        toast.error("Tujuan tidak tersedia.");
        return;
      }
      if (target.kind === "native") {
        if (
          ["/ledger", "/projects", "/expenses", "/approvals"].includes(target.href.pathname) &&
          main.select(target.href.pathname.slice(1), target.href.params)
        ) {
          const root = navigation.getRootState();
          const targetKey = workspaceStackToRestore(root);
          if (targetKey) {
            navigation.dispatch({ ...StackActions.popTo("(tabs)"), target: targetKey });
          }
          return;
        }
        if (currentPath.current === target.href.pathname)
          router.setParams(target.href.params ?? {});
        else if (["/ledger", "/projects", "/expenses", "/approvals"].includes(target.href.pathname))
          // Main destinations reuse their existing route, like tab selection.
          router.navigate(target.href);
        else router.push(target.href);
        return;
      }
      const browserUrl = new URL(target.path, `${getWebBaseURL()}/`);
      browserUrl.searchParams.set("surface", "mobile");
      void WebBrowser.openBrowserAsync(browserUrl.toString())
        .then(async () => {
          const path = new URL(target.path, "https://atria.invalid").pathname;
          if (path.startsWith("/profile") || path.startsWith("/settings")) await refreshAuth();
          const domains = path.startsWith("/projects")
            ? ["projects", "projectOverview", "ledger"]
            : path.startsWith("/expenses") || path.startsWith("/approvals")
              ? ["expenses", "approvals", "ledger"]
              : ["ledger"];
          await Promise.all(
            domains.map((name) =>
              queryClient.invalidateQueries({ queryKey: ["screen", name], refetchType: "active" }),
            ),
          );
        })
        .catch(() => toast.error("Halaman web belum dapat dibuka. Coba lagi."));
    },
    [main, navigation, queryClient, refreshAuth, router],
  );
}
