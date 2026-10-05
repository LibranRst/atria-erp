export type NavigationTree = {
  readonly type?: string;
  readonly key?: string;
  readonly index?: number;
  readonly routes: readonly {
    readonly name: string;
    readonly params?: unknown;
    readonly state?: NavigationTree;
  }[];
};

export type WorkspaceChromeLocation = {
  readonly pathname: string;
  readonly state: NavigationTree | undefined;
  readonly sheetPresented: boolean;
  readonly hasBack: boolean;
};

function isSheetRoute(name: string): boolean {
  const path = name.replace(/^\/+/, "").replace(/\/index$/, "");
  return path.startsWith("modal/") || path === "expenses/new";
}

function underlyingChromeState(state: NavigationTree | undefined): {
  readonly state: NavigationTree | undefined;
  readonly sheetPresented: boolean;
} {
  if (!state) return { state, sheetPresented: false };
  const activeIndex = state.index ?? 0;
  let sourceIndex = activeIndex;
  if (state.type === "stack" || state.type === undefined) {
    while (sourceIndex >= 0 && isSheetRoute(state.routes[sourceIndex]?.name ?? "")) sourceIndex--;
  }
  const sheetPresented = sourceIndex !== activeIndex;
  if (sourceIndex < 0) return { state: undefined, sheetPresented };
  const source = state.routes[sourceIndex];
  if (!source) return { state, sheetPresented };
  const child = underlyingChromeState(source.state);
  if (!sheetPresented && child.state === source.state) return { state, sheetPresented: false };
  return {
    state: {
      ...state,
      index: sourceIndex,
      routes: state.routes.map((route, index) =>
        index === sourceIndex ? { ...route, state: child.state } : route,
      ),
    },
    sheetPresented: sheetPresented || child.sheetPresented,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function activePathSegments(state: NavigationTree | undefined): readonly string[] | undefined {
  if (!state) return [];
  const route = state.routes[state.index ?? 0];
  if (!route) return undefined;
  const segments: string[] = [];
  for (const segment of route.name.split("/")) {
    if (!segment || segment === "__root" || segment === "index" || /^\(.+\)$/.test(segment))
      continue;
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const value = isRecord(route.params) ? route.params[segment.slice(1, -1)] : undefined;
      if (typeof value !== "string" || !value) return undefined;
      segments.push(encodeURIComponent(value));
    } else segments.push(segment);
  }
  const child = activePathSegments(route.state);
  return child ? [...segments, ...child] : undefined;
}

/** A presented route sheet does not become the underlying workspace identity. */
export function workspaceChromeLocation(
  state: NavigationTree | undefined,
  pathname: string,
): WorkspaceChromeLocation {
  const source = underlyingChromeState(state);
  const sheetPresented = source.sheetPresented || isSheetRoute(pathname);
  const segments = sheetPresented ? activePathSegments(source.state) : undefined;
  const sourcePathname = sheetPresented
    ? segments?.length
      ? `/${segments.join("/")}`
      : "/"
    : pathname;
  return {
    // A direct-open sheet with no source page keeps launch/auth chrome hidden.
    pathname: sourcePathname,
    state: source.state,
    sheetPresented,
    hasBack: sourcePathname === "/approvals" || activeRouteCanGoBack(source.state),
  };
}

export function activeRouteCanGoBack(state: NavigationTree | undefined): boolean {
  if (!state) return false;
  if (state.type === "stack" && (state.index ?? 0) > 0) return true;
  return activeRouteCanGoBack(state.routes[state.index ?? 0]?.state);
}

/** Expo may wrap the workspace stack in __root; target the owning stack. */
export function workspaceStackToRestore(state: NavigationTree): string | null {
  if (state.routes.some((route) => route.name === "(tabs)")) {
    return state.routes[state.index ?? 0]?.name === "(tabs)" ? null : (state.key ?? null);
  }
  const child = state.routes[state.index ?? 0]?.state;
  return child ? workspaceStackToRestore(child) : null;
}
