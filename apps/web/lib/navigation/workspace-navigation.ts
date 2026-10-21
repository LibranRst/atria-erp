"use client";

import { useMemo } from "react";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import { canonicalWorkspacePath } from "./workspace-routes";

export {
  useSearchParams,
  useParams,
  useSelectedLayoutSegment,
  useSelectedLayoutSegments,
} from "next/navigation";

export function usePathname(): string {
  return canonicalWorkspacePath(useNextPathname());
}

export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const href = useWorkspaceHref();
  return useMemo(
    () => ({
      ...router,
      push: (url: string, options?: Parameters<typeof router.push>[1]): void =>
        router.push(href(url), options),
      replace: (url: string, options?: Parameters<typeof router.replace>[1]): void =>
        router.replace(href(url), options),
      prefetch: (url: string, options?: Parameters<typeof router.prefetch>[1]): void =>
        router.prefetch(href(url), options),
    }),
    [router, href],
  );
}
