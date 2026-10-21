import {
  resolveSelectPresentation,
  selectDialogNeedsSearch,
} from "@atria/core/presentation/select-surface-policy";
import type { SelectPresentation } from "@atria/core/presentation/select-surface-policy";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  View,
  findNodeHandle,
  useWindowDimensions,
} from "react-native";
import { ChoiceList } from "./choice-list";
import { NativePopover } from "./native-popover";
import { SearchDialog, SelectionDialog } from "./selection-dialog";
import { useFieldRegistration } from "./sheet-form-fields";
import { SheetSelect } from "./sheet-select";
import type { SelectOption } from "./sheet-select";
import { beginChoiceSession, closeChoiceSession, completeChoiceSession } from "./choice-session";
import type { ChoicePresentationKind, ChoiceSession } from "./choice-session";
import { createDeferredChoiceCommit } from "./deferred-choice-commit";

export type AdaptiveSelectProps = {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly fieldId?: string;
  readonly error?: string;
  readonly helper?: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  readonly presentation?: SelectPresentation;
  readonly emptyText?: string;
  readonly onCreateAction?: () => void;
  readonly createActionLabel?: string;
  readonly onCreate?: () => void;
  readonly createLabel?: string;
  readonly allowCustom?: boolean;
  readonly searchable?: boolean;
  readonly customValueDescription?: string;
};

export function AdaptiveSelect({
  presentation = "auto",
  allowCustom = false,
  searchable: forceSearch = false,
  onCreateAction,
  onCreate,
  createActionLabel,
  createLabel,
  emptyText,
  customValueDescription,
  ...props
}: AdaptiveSelectProps): React.JSX.Element {
  const [session, setSession] = useState<ChoiceSession>({ visible: false, kind: null });
  const triggerRef = useRef<View>(null);
  const openRef = useRef(false);
  const { fields } = useFieldRegistration();
  const restore = useRef<(() => void) | undefined>(undefined);
  const deferredCommit = useRef(createDeferredChoiceCommit());
  const latestChoiceToken = useRef(0);
  const [choiceToken, setChoiceToken] = useState(0);
  useEffect(() => {
    const controller = createDeferredChoiceCommit();
    deferredCommit.current = controller;
    return (): void => controller.dispose();
  }, []);
  const viewport = useWindowDimensions();
  const create = onCreateAction ?? onCreate;
  const policy = {
    options: props.options,
    presentation,
    hasCreateAction: Boolean(create),
    hasCustomValue: allowCustom || forceSearch,
  };
  const resolved = resolveSelectPresentation(policy);
  const searchable = selectDialogNeedsSearch(policy);
  const requestedKind: ChoicePresentationKind =
    resolved === "menu" ? "menu" : searchable ? "search" : "dialog";
  const kind = session.kind ?? requestedKind;
  const open = session.visible;
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);
  if (open && (props.disabled || props.readOnly)) setSession(closeChoiceSession(session));
  const close = (): void => {
    setSession(closeChoiceSession);
  };
  const restoreAfterDismiss = useCallback((): void => {
    if (openRef.current || latestChoiceToken.current !== choiceToken) return;
    const committed = Platform.OS === "ios" && deferredCommit.current.complete(choiceToken);
    const returnPosition = restore.current;
    restore.current = undefined;
    setSession(completeChoiceSession);
    const returnFocus = (): void => {
      if (openRef.current || latestChoiceToken.current !== choiceToken) return;
      returnPosition?.();
      if (!fields || !props.fieldId) {
        const node = findNodeHandle(triggerRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    };
    // Parent fields resize after UIKit has removed the native presentation.
    if (committed) requestAnimationFrame(returnFocus);
    else returnFocus();
  }, [fields, props.fieldId, setSession, choiceToken]);
  const trigger = (
    <View ref={triggerRef} collapsable={false}>
      <SheetSelect
        {...props}
        onPress={() => {
          if (props.disabled || props.readOnly) return;
          if (kind === "menu") {
            const token = deferredCommit.current.begin();
            latestChoiceToken.current = token;
            setChoiceToken(token);
            restore.current = fields?.captureReadingPosition(props.fieldId, {
              restoreScroll: Platform.OS !== "ios",
            });
            Keyboard.dismiss();
          }
          setSession((current) => beginChoiceSession(current, requestedKind));
        }}
      />
    </View>
  );
  if (kind === "menu")
    return (
      <NativePopover
        visible={open}
        onClose={close}
        onDismiss={restoreAfterDismiss}
        content={
          <ChoiceList
            options={props.options}
            value={props.value}
            onSelect={(value) => {
              if (Platform.OS === "ios")
                deferredCommit.current.select(choiceToken, value, props.onChange);
              else props.onChange(value);
              close();
            }}
            maxHeight={Math.min(380, viewport.height * 0.55)}
            emptyText={emptyText}
          />
        }
      >
        {trigger}
      </NativePopover>
    );
  const Dialog = kind === "search" ? SearchDialog : SelectionDialog;
  return (
    <>
      {trigger}
      <Dialog
        visible={open}
        title={props.label}
        options={props.options}
        value={props.value}
        onSelect={props.onChange}
        onClose={close}
        onExitComplete={restoreAfterDismiss}
        returnFocusField={props.fieldId}
        emptyText={emptyText}
        onCreateAction={create}
        createActionLabel={createActionLabel ?? createLabel}
        allowCustom={allowCustom}
        customValueDescription={customValueDescription}
      />
    </>
  );
}

export type ComboboxFieldProps = Omit<AdaptiveSelectProps, "options" | "allowCustom"> & {
  readonly options: readonly string[];
  readonly allowCustomValue?: boolean;
  readonly createCustomDescription?: string;
};

export function ComboboxField({
  options,
  allowCustomValue = true,
  createCustomDescription,
  ...props
}: ComboboxFieldProps): React.JSX.Element {
  const choices = Array.from(new Set([...options, props.value].filter(Boolean))).map((value) => ({
    value,
    label: value,
  }));
  return (
    <AdaptiveSelect
      {...props}
      options={choices}
      presentation="dialog"
      allowCustom={allowCustomValue}
      searchable
      customValueDescription={createCustomDescription}
    />
  );
}
