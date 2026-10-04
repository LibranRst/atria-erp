import { AsyncLocalStorage } from "node:async_hooks";

export type Invalidation = {
  readonly path: string;
  readonly type?: "page" | "layout";
};
export type AfterEffect = () => void | Promise<void>;
export type RequestContext = {
  readonly request: Request;
  readonly invalidations: Map<string, Invalidation>;
  readonly afterEffects: AfterEffect[];
};
export type RequestExecution<T> = {
  readonly value: T;
  readonly invalidations: readonly Invalidation[];
  readonly afterEffects: readonly AfterEffect[];
};

const storage = new AsyncLocalStorage<RequestContext>();

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requireRequestContext(): RequestContext {
  const context = currentRequestContext();
  if (!context) throw new Error("Operasi ini membutuhkan konteks request API.");
  return context;
}

export async function withRequestContext<T>(
  request: Request,
  handler: () => T | Promise<T>,
): Promise<RequestExecution<T>> {
  const context: RequestContext = {
    request,
    invalidations: new Map(),
    afterEffects: [],
  };
  return storage.run(context, async (): Promise<RequestExecution<T>> => ({
    value: await handler(),
    invalidations: [...context.invalidations.values()],
    afterEffects: [...context.afterEffects],
  }));
}

export async function headers(): Promise<Headers> {
  return new Headers(requireRequestContext().request.headers);
}

type RequestCookie = { readonly name: string; readonly value: string };
export type RequestCookies = {
  get(name: string): RequestCookie | undefined;
  getAll(name?: string): readonly RequestCookie[];
  has(name: string): boolean;
  toString(): string;
};

export async function cookies(): Promise<RequestCookies> {
  const raw = requireRequestContext().request.headers.get("cookie") ?? "";
  const values: RequestCookie[] = raw.split(";").flatMap((part): RequestCookie[] => {
    const separator = part.indexOf("=");
    if (separator < 0) return [];
    const name = part.slice(0, separator).trim();
    return name ? [{ name, value: part.slice(separator + 1).trim() }] : [];
  });
  return {
    get: (name: string): RequestCookie | undefined => values.find((item) => item.name === name),
    getAll: (name?: string): readonly RequestCookie[] =>
      name === undefined ? [...values] : values.filter((item) => item.name === name),
    has: (name: string): boolean => values.some((item) => item.name === name),
    toString: (): string => raw,
  };
}
