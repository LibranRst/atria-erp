import { currentRequestContext, type RequestContext } from "./request-context";

type CacheEntry<T> =
  | { readonly kind: "value"; readonly value: T }
  | { readonly kind: "error"; readonly error: unknown };
type CacheNode<T> = { readonly children: Map<unknown, CacheNode<T>>; entry?: CacheEntry<T> };

function node<T>(): CacheNode<T> {
  return { children: new Map() };
}

/** A memo belongs to one HTTP request, never to a user's later requests. */
export function cache<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  const roots = new WeakMap<RequestContext, CacheNode<TResult>>();
  return (...args: TArgs): TResult => {
    const context = currentRequestContext();
    if (!context) return fn(...args);
    const existing = roots.get(context);
    let current: CacheNode<TResult> = existing ?? node<TResult>();
    if (!existing) roots.set(context, current);
    for (const argument of args) {
      let child: CacheNode<TResult> | undefined = current.children.get(argument);
      if (!child) {
        child = node<TResult>();
        current.children.set(argument, child);
      }
      current = child;
    }
    if (current.entry?.kind === "value") return current.entry.value;
    if (current.entry?.kind === "error") throw current.entry.error;
    try {
      const value = fn(...args);
      current.entry = { kind: "value", value };
      return value;
    } catch (error: unknown) {
      current.entry = { kind: "error", error };
      throw error;
    }
  };
}
