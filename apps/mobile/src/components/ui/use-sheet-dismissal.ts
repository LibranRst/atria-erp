import { useNavigation } from "expo-router";
import { usePreventRemove, type NavigationAction } from "expo-router/react-navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useSyncExternalStore,
} from "react";
import { Alert } from "react-native";
import { sheetDismissalDecision } from "./sheet-state";
import type { SheetFormFields } from "./sheet-form-fields";

const noControlEdits = (): boolean => false;
const noControlSubscription =
  (_listener: () => void): (() => void) =>
  (): void => {};

export type SheetDismissal = {
  readonly requestClose: () => void;
  readonly complete: () => void;
  readonly pending: boolean;
};

/** One owner for system X, native dismissal and Android Back. */
export function useSheetDismissal({
  dirty = false,
  pending = false,
  onDiscard,
  fields,
}: {
  readonly dirty?: boolean;
  readonly pending?: boolean;
  readonly onDiscard?: () => void | Promise<void>;
  readonly fields?: SheetFormFields;
} = {}): SheetDismissal {
  const navigation = useNavigation();
  const uncommitted = useSyncExternalStore(
    fields?.subscribeControlState ?? noControlSubscription,
    fields?.hasUncommittedEdits ?? noControlEdits,
    noControlEdits,
  );
  const effectiveDirty = dirty || uncommitted;
  const [exit, setExit] = useState<{ readonly action?: NavigationAction } | null>(null);
  const confirming = useRef(false);
  const latest = useRef({ dirty: effectiveDirty, pending, onDiscard });
  useLayoutEffect(() => {
    latest.current = { dirty: effectiveDirty, pending, onDiscard };
  }, [effectiveDirty, pending, onDiscard]);

  usePreventRemove(!exit && (effectiveDirty || pending), ({ data }): void => {
    const decision = sheetDismissalDecision(latest.current);
    if (decision === "block" || confirming.current) return;
    if (decision === "close") {
      setExit({ action: data.action });
      return;
    }
    confirming.current = true;
    Alert.alert(
      "Tutup tanpa menyimpan?",
      "Perubahan pada form ini akan dibuang.",
      [
        {
          text: "Lanjut isi",
          style: "cancel",
          onPress: () => {
            confirming.current = false;
          },
        },
        {
          text: "Buang perubahan",
          style: "destructive",
          onPress: (): void => {
            if (latest.current.pending) {
              confirming.current = false;
              return;
            }
            void Promise.resolve(latest.current.onDiscard?.())
              .then(() => {
                setExit({ action: data.action });
              })
              .catch(() => {
                confirming.current = false;
                Alert.alert("Draft belum dapat dibuang", "Coba lagi. Form masih terbuka.");
              });
          },
        },
      ],
      { cancelable: false },
    );
  });

  // Disable the native prevent-dismiss flag before dispatching the approved action.
  useEffect(() => {
    if (!exit) return;
    if (exit.action) navigation.dispatch(exit.action);
    else navigation.goBack();
  }, [exit, navigation]);
  const requestClose = useCallback((): void => {
    if (!latest.current.pending && !confirming.current) navigation.goBack();
  }, [navigation]);
  const complete = useCallback((): void => {
    setExit({});
  }, []);
  return useMemo(() => ({ requestClose, complete, pending }), [requestClose, complete, pending]);
}
