"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { RouterProvider } from "@heroui/react";
import { Button, Modal } from "@/components/ui";
import {
  createUnsavedChangesStore,
  leaveDecision,
  leaveDestination,
  type LeaveDestination,
  type UnsavedDraft,
} from "./unsaved-changes-policy";

type GuardedAction = (leaveDocument: (href: string) => void) => Promise<void>;
type Transition =
  | { readonly kind: "link"; readonly destination: LeaveDestination }
  | { readonly kind: "action"; readonly action: GuardedAction };
interface NavigationGuard {
  readonly store: ReturnType<typeof createUnsavedChangesStore>;
  readonly requestAction: (action: GuardedAction) => void;
}
const GuardContext = createContext<NavigationGuard | null>(null);

export function UnsavedChangesProvider({
  children,
  navigate,
}: {
  readonly children: React.ReactNode;
  readonly navigate: (href: string) => void;
}): React.JSX.Element {
  const [store] = useState(createUnsavedChangesStore);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [transition, setTransition] = useState<Transition | null>(null);
  const bypassUnload = useRef(false);

  const leaveDocument = useCallback((href: string): void => {
    bypassUnload.current = true;
    window.location.replace(href);
  }, []);
  const execute = useCallback(
    (next: Transition): void => {
      if (next.kind === "action") {
        void next.action(leaveDocument);
        return;
      }
      if (next.destination.external) {
        bypassUnload.current = true;
        window.location.assign(next.destination.href);
      } else navigate(next.destination.href);
    },
    [leaveDocument, navigate],
  );
  const request = useCallback(
    (next: Transition): void => {
      const decision = leaveDecision(
        store.getSnapshot(),
        next.kind === "action" || next.destination.leavesPage,
      );
      if (decision === "allow") execute(next);
      else setTransition(next);
    },
    [execute, store],
  );
  const requestHref = useCallback(
    (href: string): void => {
      const destination = leaveDestination(href, window.location.href);
      if (destination) request({ kind: "link", destination });
    },
    [request],
  );
  const requestAction = useCallback(
    (action: GuardedAction): void => request({ kind: "action", action }),
    [request],
  );

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent): void {
      if (bypassUnload.current) {
        bypassUnload.current = false;
        return;
      }
      if (leaveDecision(store.getSnapshot()) !== "allow") event.preventDefault();
    }
    function captureLink(event: MouseEvent): void {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      )
        return;
      const destination = leaveDestination(anchor.href, window.location.href);
      if (!destination || leaveDecision(store.getSnapshot(), destination.leavesPage) === "allow")
        return;
      event.preventDefault();
      event.stopPropagation();
      request({ kind: "link", destination });
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", captureLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", captureLink, true);
    };
  }, [request, store]);

  return (
    <GuardContext value={{ store, requestAction }}>
      <RouterProvider navigate={requestHref}>{children}</RouterProvider>
      <Modal>
        <Modal.Backdrop
          isOpen={transition !== null}
          onOpenChange={(open) => {
            if (!open) setTransition(null);
          }}
        >
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  {snapshot.pending
                    ? "Perubahan sedang diproses"
                    : "Buang perubahan yang belum disimpan?"}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {snapshot.pending
                    ? "Tunggu proses selesai sebelum meninggalkan halaman ini."
                    : `Perubahan ${snapshot.label} belum disimpan. Tetap di halaman ini untuk melanjutkan, atau buang perubahan dan lanjutkan.`}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button size="sm" variant="secondary" onPress={() => setTransition(null)}>
                  Tetap di halaman ini
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isDisabled={snapshot.pending}
                  onPress={() => {
                    if (!transition || snapshot.pending) return;
                    const next = transition;
                    setTransition(null);
                    execute(next);
                  }}
                >
                  {snapshot.dirty ? "Buang dan lanjutkan" : "Lanjutkan"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </GuardContext>
  );
}

export function useUnsavedChanges(draft: UnsavedDraft): void {
  const guard = useContext(GuardContext);
  const id = useId();
  if (!guard) throw new Error("UnsavedChangesProvider wajib membungkus editor admin.");
  const { store } = guard;
  const { dirty, pending, label } = draft;
  useEffect(() => {
    store.register(id, { dirty, pending, label });
    return () => store.remove(id);
  }, [store, id, dirty, pending, label]);
}

export function useGuardedLeaveAction(): (action: GuardedAction) => void {
  const guard = useContext(GuardContext);
  if (!guard) throw new Error("UnsavedChangesProvider wajib membungkus navigasi admin.");
  return guard.requestAction;
}
