export type ChoicePresentationKind = "menu" | "search" | "dialog";
export type ChoiceSession = {
  readonly visible: boolean;
  readonly kind: ChoicePresentationKind | null;
};

export function beginChoiceSession(
  session: ChoiceSession,
  requested: ChoicePresentationKind,
): ChoiceSession {
  return { visible: true, kind: session.kind ?? requested };
}
export function closeChoiceSession(session: ChoiceSession): ChoiceSession {
  return { ...session, visible: false };
}
export function completeChoiceSession(session: ChoiceSession): ChoiceSession {
  return session.visible ? session : { visible: false, kind: null };
}
