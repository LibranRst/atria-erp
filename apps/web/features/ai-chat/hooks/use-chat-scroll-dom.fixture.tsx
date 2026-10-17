import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ChatScroll } from "./use-chat-scroll";

const width = Number(process.argv[2] ?? 390);
const browserWindow = new Window({ url: "https://atria.test/ai", width });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "KeyboardEvent",
  "WheelEvent",
  "PointerEvent",
  "getComputedStyle",
]) {
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    key === "getComputedStyle" && typeof value === "function" ? value.bind(browserWindow) : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

// Keep browser-owned geometry and observer timing explicit. The real hook is
// exercised; no production scrolling method or policy is replaced.
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
Reflect.set(globalThis, "requestAnimationFrame", (callback: FrameRequestCallback): number => {
  const id = ++nextFrame;
  frames.set(id, callback);
  return id;
});
Reflect.set(globalThis, "cancelAnimationFrame", (id: number): void => {
  frames.delete(id);
});

class ManualResizeObserver implements ResizeObserver {
  static readonly instances = new Set<ManualResizeObserver>();
  readonly targets = new Set<Element>();
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ManualResizeObserver.instances.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    ManualResizeObserver.instances.delete(this);
  }
}
Reflect.set(globalThis, "ResizeObserver", ManualResizeObserver);

const { createRoot } = await import("react-dom/client");
const { useChatScroll, USER_MESSAGE_ATTRIBUTE } = await import("./use-chat-scroll");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let controls: ChatScroll | null = null;
let streaming = false;
let height = width >= 1024 ? 800 : 600;
let contentHeight = 2400;
let anchorOffset = 1900;
let position = 0;
let inset = width >= 1024 ? 16 : 64;
const writes: number[] = [];

function Harness({ active }: { readonly active: boolean }): React.JSX.Element {
  const { viewportRef, contentRef, ...methods } = useChatScroll(active);
  React.useLayoutEffect((): void => {
    controls = { viewportRef, contentRef, ...methods };
  });
  return (
    <div ref={viewportRef} style={{ paddingTop: inset }}>
      <div ref={contentRef}>
        <div {...{ [USER_MESSAGE_ATTRIBUTE]: "" }}>Pertanyaan QA terbaru</div>
      </div>
    </div>
  );
}

function scroll(): ChatScroll {
  assert.ok(controls, "The real hook must be mounted before interaction.");
  return controls;
}

async function render(active: boolean): Promise<void> {
  streaming = active;
  await act(async (): Promise<void> => {
    root.render(<Harness active={streaming} />);
  });
}

await render(false);
function requireElement<T extends Element>(element: T | null, name: string): T {
  if (element === null) throw new Error(`The mounted ${name} must exist.`);
  return element;
}
const viewport = requireElement(scroll().viewportRef.current, "viewport");
const content = requireElement(scroll().contentRef.current, "content");
const anchor = requireElement(
  viewport.querySelector<HTMLElement>(`[${USER_MESSAGE_ATTRIBUTE}]`),
  "user question",
);
Object.defineProperties(viewport, {
  scrollHeight: { get: (): number => contentHeight },
  clientHeight: { get: (): number => height },
  scrollTop: {
    get: (): number => position,
    set: (value: number): void => {
      position = Math.min(Math.max(0, contentHeight - height), Math.max(0, value));
      writes.push(position);
    },
  },
});
viewport.getBoundingClientRect = (): DOMRect => new browserWindow.DOMRect(0, 0, width, height);
anchor.getBoundingClientRect = (): DOMRect =>
  new browserWindow.DOMRect(0, anchorOffset - position, width, 48);
viewport.scrollTo = (options?: ScrollToOptions | number, y?: number): void => {
  viewport.scrollTop = typeof options === "number" ? (y ?? 0) : (options?.top ?? 0);
};

async function flushFrames(): Promise<void> {
  await act(async (): Promise<void> => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

async function resizeContent(): Promise<void> {
  await act(async (): Promise<void> => {
    for (const observer of [...ManualResizeObserver.instances]) {
      if (observer.targets.has(content)) observer.callback([], observer);
    }
  });
}

async function interact(action: () => void): Promise<void> {
  await act(async (): Promise<void> => action());
}

function setReaderPosition(next: number): void {
  // Reader/browser movement is separate from writes made by the hook.
  position = next;
}

async function dispatchScroll(): Promise<void> {
  await interact((): void => {
    viewport.dispatchEvent(new Event("scroll"));
  });
}

async function pauseWithWheel(): Promise<void> {
  await interact((): void => {
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
  });
}

// Opening history aligns once, including late card layout, but does not opt the
// reader into following later disclosure or idle content changes.
await interact((): void => scroll().openAtBottom());
assert.equal(position, contentHeight - height, "Opening must land at the existing bottom.");
contentHeight += 80;
await resizeContent();
assert.equal(position, contentHeight - height, "Initial late layout should settle at bottom.");
await act(async (): Promise<void> => {
  await new Promise<void>((resolve): void => {
    setTimeout(resolve, 450);
  });
});
const openingPosition = position;
contentHeight += 300;
await resizeContent();
assert.equal(position, openingPosition, "Settled history must keep the reader's position.");
assert.equal(
  scroll().awayFromBottom,
  true,
  "Idle growth keeps the latest-answer control available.",
);

// A new question cancels opening/settling and follows only until the question
// reaches the top reading inset. An incidental scroll event cannot opt into
// unbounded bottom following.
await render(true);
await interact((): void => scroll().resumeFollowing());
setReaderPosition(0);
contentHeight = 3600;
anchorOffset = 1900;
await interact((): void => scroll().followStream());
await flushFrames();
assert.equal(position, anchorOffset - inset, "The question remains the reading anchor.");
await dispatchScroll();
contentHeight = 5200;
await resizeContent();
assert.equal(position, anchorOffset - inset, "Longer replies must not pull past the question.");

// Recover an overshoot left by a browser/programmatic scroll, rather than
// retaining it via Math.max(previousPosition, questionTarget).
setReaderPosition(anchorOffset + 100);
await resizeContent();
assert.equal(position, anchorOffset - inset, "Following must recover accidental overshoot.");
setReaderPosition(contentHeight - height);
await dispatchScroll();
contentHeight += 100;
await resizeContent();
assert.equal(
  position,
  anchorOffset - inset,
  "A programmatic bottom event must not enable persistent bottom following.",
);

// Upward intent wins even when a follow frame was queued just beforehand.
await interact((): void => scroll().followStream());
assert.ok(frames.size > 0, "A follow frame should be queued before reader interruption.");
await pauseWithWheel();
setReaderPosition(900);
const pausedWrites = writes.length;
await flushFrames();
contentHeight += 500;
await resizeContent();
assert.equal(position, 900, "Upward reading must cancel the pending follow frame.");
assert.equal(writes.length, pausedWrites, "Content growth must not issue a paused snap.");

// Genuine downward reading back to the bottom is an intentional opt-in.
await interact((): void => {
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 120 }));
});
setReaderPosition(contentHeight - height);
await dispatchScroll();
contentHeight += 150;
await resizeContent();
assert.equal(position, contentHeight - height, "Reader return to bottom resumes following.");

// Keyboard and touch reading interrupt the same queued work, while moving a
// caret inside the composer remains unrelated to conversation scrolling.
await interact((): void => scroll().resumeFollowing());
await interact((): void => scroll().followStream());
await interact((): void => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp" }));
});
setReaderPosition(750);
await flushFrames();
await resizeContent();
assert.equal(position, 750, "Keyboard reading cancels the pending frame and observer follow.");

await interact((): void => scroll().resumeFollowing());
await interact((): void => scroll().followStream());
await interact((): void => {
  const start = new Event("touchstart");
  Object.defineProperty(start, "touches", { value: [{ clientY: 100 }] });
  viewport.dispatchEvent(start);
  const move = new Event("touchmove");
  Object.defineProperty(move, "touches", { value: [{ clientY: 150 }] });
  viewport.dispatchEvent(move);
});
setReaderPosition(650);
await flushFrames();
await resizeContent();
assert.equal(position, 650, "Touch reading cancels the pending frame and observer follow.");

const composer = document.createElement("textarea");
document.body.append(composer);
await interact((): void => scroll().resumeFollowing());
await interact((): void => scroll().followStream());
await interact((): void => {
  composer.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
});
await flushFrames();
assert.equal(position, anchorOffset - inset, "Composer caret movement does not pause following.");
composer.remove();

// The explicit latest-answer control opts into bottom following while active.
await interact((): void => scroll().jumpToBottom());
assert.equal(position, contentHeight - height, "The explicit jump reaches the newest answer.");
contentHeight += 400;
await resizeContent();
assert.equal(position, contentHeight - height, "Explicit bottom following tracks active growth.");

// Starting another question resets that explicit mode and cancels its settle
// observer so the old jump cannot win after the next content resize.
anchorOffset = 3100;
await interact((): void => scroll().resumeFollowing());
setReaderPosition(0);
await resizeContent();
assert.equal(position, anchorOffset - inset, "The next question resets explicit bottom mode.");
await interact((): void => scroll().followStream());
await flushFrames();
assert.equal(position, anchorOffset - inset);

// A responsive layout change recomputes the same question's reading inset.
height += 100;
inset = inset === 16 ? 64 : 16;
await render(true);
await resizeContent();
assert.equal(position, anchorOffset - inset, "Resize must preserve the question anchor.");

// Completion removes continuous content-following; final card/accordion growth
// after the completed turn preserves the settled reading position.
await render(false);
const completedPosition = position;
const completedWrites = writes.length;
contentHeight += 600;
await resizeContent();
assert.equal(position, completedPosition, "Idle card growth must not move reading position.");
assert.equal(writes.length, completedWrites, "Idle observation must be read-only.");
assert.equal(
  scroll().awayFromBottom,
  true,
  "New idle content leaves an explicit way to jump down.",
);

// Reader interaction during the opening's brief settling window cancels that
// alignment too, even though no reply is streaming yet.
await interact((): void => scroll().openAtBottom());
await interact((): void => {
  viewport.dispatchEvent(new PointerEvent("pointerdown"));
});
setReaderPosition(contentHeight - height - 120);
const interruptedOpeningPosition = position;
const interruptedOpeningWrites = writes.length;
contentHeight += 100;
await resizeContent();
assert.equal(
  position,
  interruptedOpeningPosition,
  "Early idle reader interaction cancels settling.",
);
assert.equal(
  writes.length,
  interruptedOpeningWrites,
  "Canceled opening must not issue another snap.",
);

// A second opening can be interrupted by a new question before its 400 ms
// settling window expires. This is the initial/new-conversation race.
await interact((): void => scroll().openAtBottom());
await render(true);
anchorOffset = 4300;
await interact((): void => scroll().resumeFollowing());
setReaderPosition(0);
await resizeContent();
assert.equal(position, anchorOffset - inset, "A new question cancels opening's settle observer.");

await act(async (): Promise<void> => root.unmount());
assert.equal(frames.size, 0, "Unmount must cancel pending animation frames.");
assert.equal(ManualResizeObserver.instances.size, 0, "Unmount must disconnect every observer.");
await browserWindow.happyDOM.abort();
console.log(`chat scroll DOM passed (${width}px)`);
