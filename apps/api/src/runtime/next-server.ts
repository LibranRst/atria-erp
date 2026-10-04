import { requireRequestContext, type AfterEffect } from "./request-context";

/** Domain commit effects register work after COMMIT; transport owns dispatch. */
export function after(effect: AfterEffect): void {
  requireRequestContext().afterEffects.push(effect);
}
