import { createHash } from "node:crypto";

import { resolveActorFromHeaders, type Actor } from "@/server/actor";
import { getNotificationStreamCursor } from "@/server/usecases/notifications/notification-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STREAM_POLL_MS = 5_000;
const STREAM_LIFETIME_MS = 25_000;
const encoder = new TextEncoder();

function sessionSignature(actor: Actor): string {
  return createHash("sha256")
    .update(
      [actor.userId, actor.roleId, actor.dataScope, [...actor.permissions].sort().join(",")].join(
        "|",
      ),
    )
    .digest("base64url");
}

function event(input: {
  readonly name: string;
  readonly data: unknown;
  readonly id?: string;
}): Uint8Array {
  const id = input.id ? `id: ${input.id}\n` : "";
  return encoder.encode(`${id}event: ${input.name}\ndata: ${JSON.stringify(input.data)}\n\n`);
}

export async function GET(request: Request): Promise<Response> {
  const actor = await resolveActorFromHeaders(request.headers);
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let stopStream: () => void = () => undefined;
  const requestedCursor =
    new URL(request.url).searchParams.get("cursor") ?? request.headers.get("last-event-id");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let active = true;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;
      let lastCursor = requestedCursor;

      const stop = (): void => {
        if (!active) return;
        active = false;
        clearTimeout(pollTimer);
        clearTimeout(lifetimeTimer);
        request.signal.removeEventListener("abort", stop);
        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };
      const lifetimeTimer = setTimeout(() => {
        if (active) controller.enqueue(event({ name: "rotate", data: { reconnect: true } }));
        stop();
      }, STREAM_LIFETIME_MS);
      stopStream = stop;
      request.signal.addEventListener("abort", stop, { once: true });

      controller.enqueue(encoder.encode("retry: 1500\n\n"));
      controller.enqueue(event({ name: "session", data: { signature: sessionSignature(actor) } }));

      const poll = async (): Promise<void> => {
        if (!active) return;
        try {
          const cursor = await getNotificationStreamCursor(actor);
          if (!active) return;
          if (cursor !== lastCursor) {
            lastCursor = cursor;
            controller.enqueue(event({ name: "invalidate", id: cursor, data: { cursor } }));
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch {
          if (active) controller.enqueue(event({ name: "stream-error", data: { retry: true } }));
          stop();
          return;
        }
        if (active) pollTimer = setTimeout(() => void poll(), STREAM_POLL_MS);
      };

      void poll();
    },
    cancel() {
      stopStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
