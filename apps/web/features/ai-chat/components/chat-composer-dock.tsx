"use client";
import * as React from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { Button, AppIcon } from "@/components/ui";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { ChatComposer, type ChatComposerProps } from "./chat-composer";
import { MorphedInputComposer } from "./morphed-input-composer";
import { initialWizardProgress } from "../utils/input-request-fields";
import type { ActiveInputRequest } from "../utils/input-request-reader";
import { wizardPrimarySteps } from "@atria/core/ai/input-request-flow";
import type { ComposerWizardState } from "../utils/workspace-session";

function PresentContent({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const present = useIsPresent();
  return (
    <div inert={!present} aria-hidden={!present || undefined}>
      {children}
    </div>
  );
}

export function ChatComposerDock({
  request,
  conversationId,
  onWizardSubmit,
  onWizardCancel,
  wizardState,
  onWizardStateChange,
  ...composer
}: ChatComposerProps & {
  readonly request: ActiveInputRequest | null;
  readonly conversationId: string | null;
  readonly onWizardSubmit: (text: string) => void;
  readonly onWizardCancel: () => void;
  readonly wizardState?: ComposerWizardState;
  readonly onWizardStateChange?: React.Dispatch<React.SetStateAction<ComposerWizardState>>;
}): React.JSX.Element {
  const [localWizard, setLocalWizard] = React.useState<ComposerWizardState>({
    progresses: {},
    paused: [],
  });
  const currentWizard = wizardState ?? localWizard;
  const updateWizard = onWizardStateChange ?? setLocalWizard;
  const paused = new Set(currentWizard.paused);
  const progresses = currentWizard.progresses;
  const [height, setHeight] = React.useState(56);
  const content = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const key = request
    ? (wizardState ? "" : (conversationId ?? "new") + ":") + request.toolCallId
    : "";
  const progress = request ? (progresses[key] ?? initialWizardProgress(request.payload)) : null;
  const wizard = Boolean(request && !paused.has(key) && !composer.isBusy);
  const steps = request && progress ? wizardPrimarySteps(request.payload, progress.values) : [];
  const currentField = request?.payload.fields[progress?.currentStep ?? 0];
  const currentPosition = steps.findIndex(
    (index) =>
      request?.payload.fields[index].key === (currentField?.groupWith ?? currentField?.key),
  );

  React.useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = (): void => setHeight(node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height, borderRadius: wizard ? 28 : 32 }}
      transition={reduced ? { duration: 0 } : transitionSpringSmooth}
      className="relative min-w-0 overflow-hidden bg-surface-container-lowest shadow-control ring-1 ring-ring-control focus-within:ring-2 focus-within:ring-focus-ring"
      data-composer-dock=""
    >
      <div ref={content} className="relative min-w-0">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={wizard ? "wizard" : "message"}
            initial={reduced ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={reduced ? { duration: 0 } : transitionSpringSmooth}
            className="relative min-w-0"
          >
            <PresentContent>
              {wizard && request && progress ? (
                <MorphedInputComposer
                  payload={request.payload}
                  progress={progress}
                  onProgressChange={(next) =>
                    updateWizard((current) => ({
                      ...current,
                      progresses: {
                        ...current.progresses,
                        [key]:
                          typeof next === "function"
                            ? next(
                                current.progresses[key] ?? initialWizardProgress(request.payload),
                              )
                            : next,
                      },
                    }))
                  }
                  onPause={() =>
                    updateWizard((current) => ({
                      ...current,
                      paused: [...new Set([...current.paused, key])],
                    }))
                  }
                  onSubmit={onWizardSubmit}
                  onCancel={onWizardCancel}
                  disabled={composer.disabled}
                />
              ) : (
                <>
                  {request && progress && !composer.isBusy && (
                    <div className="flex min-w-0 items-center gap-2 px-4 pt-2">
                      <span className="min-w-0 flex-1 truncate text-meta text-on-surface-variant">
                        {request.payload.actionTitle} · {Math.max(0, currentPosition) + 1}/
                        {steps.length}
                      </span>
                      <Button
                        type="button"
                        size="compact"
                        variant="secondary"
                        className="shrink-0 bg-surface-container-lowest! text-on-surface! shadow-none!"
                        onClick={() =>
                          updateWizard((current) => ({
                            ...current,
                            paused: current.paused.filter((item) => item !== key),
                          }))
                        }
                      >
                        <AppIcon name="arrow_forward" className="icon-sm" />
                        Lanjutkan isian
                      </Button>
                    </div>
                  )}
                  <ChatComposer
                    {...composer}
                    embedded
                    autoFocus={Boolean(request && !composer.isBusy)}
                  />
                </>
              )}
            </PresentContent>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
