import { resolveActorFromHeaders } from "@backend/server/actor";
import { sessionAccessFailure } from "@backend/lib/server/session-access";
import {
  readPrivateAttachment,
  uploadPrivateAttachment,
} from "@backend/server/usecases/media/private-attachments";
import {
  signUploadTicket,
  uploadTicketInputSchema,
  verifyUploadTicket,
  type UploadTicket,
} from "@backend/lib/media/upload-ticket";
import { db } from "@backend/db";
import { session } from "@backend/db/schema";
import { and, eq, gt } from "drizzle-orm";

const claimedTickets = new Map<string, number>();

export async function handleMediaRequest(request: Request): Promise<Response> {
  let ticket: UploadTicket | null = null;
  let headers = request.headers;
  const ticketValue = request.headers.get("x-atria-upload-ticket");
  if (ticketValue) {
    try {
      ticket = verifyUploadTicket(ticketValue, process.env.BETTER_AUTH_SECRET ?? "");
      const active = await db.query.session.findFirst({
        where: and(
          eq(session.id, ticket.sessionId),
          eq(session.userId, ticket.userId),
          gt(session.expiresAt, new Date()),
        ),
        columns: { token: true },
      });
      if (!active) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });
      headers = new Headers({ authorization: `Bearer ${active.token}` });
    } catch {
      return Response.json(
        { error: "Tiket unggah tidak valid atau kedaluwarsa." },
        { status: 401 },
      );
    }
  }
  const actor = await resolveActorFromHeaders(headers);
  if (!actor) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const failure = sessionAccessFailure(actor);
  if (failure) return Response.json({ error: failure.message }, { status: failure.status });
  try {
    const pathname = new URL(request.url).pathname;
    if (request.method === "POST" && pathname === "/api/media/upload-ticket") {
      const input = uploadTicketInputSchema.parse(await request.json());
      if (!process.env.BETTER_AUTH_SECRET) throw new Error("Konfigurasi autentikasi belum siap.");
      return Response.json(
        {
          ticket: signUploadTicket(
            input,
            { userId: actor.userId, sessionId: actor.sessionId },
            process.env.BETTER_AUTH_SECRET,
          ),
          uploadUrl: new URL(
            "/api/media/attachments",
            process.env.API_PUBLIC_URL ?? "http://localhost:3001",
          ).href,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/api/media/attachments") {
      const origin = request.headers.get("origin");
      if (
        origin &&
        ![
          process.env.WEB_ORIGIN ?? "http://localhost:3000",
          process.env.API_PUBLIC_URL ?? "http://localhost:3001",
        ].some((value) => new URL(value).origin === origin)
      ) {
        return Response.json({ error: "Asal permintaan ditolak." }, { status: 403 });
      }
      const form = await request.formData();
      if (ticket) {
        const file = form.get("file");
        if (!(file instanceof File) || file.name !== ticket.fileName || file.size !== ticket.size)
          throw new Error("Berkas tidak sesuai tiket unggah.");
        for (const [nonce, expiry] of claimedTickets)
          if (Date.now() >= expiry) claimedTickets.delete(nonce);
        if (claimedTickets.has(ticket.nonce))
          throw new Error("Tiket unggah sudah digunakan. Pilih berkas kembali.");
        claimedTickets.set(ticket.nonce, ticket.expiresAt);
        form.set("purpose", ticket.purpose);
        if (ticket.projectId) form.set("projectId", ticket.projectId);
        else form.delete("projectId");
      }
      return Response.json(await uploadPrivateAttachment(actor, form), {
        status: 201,
        headers: { "cache-control": "no-store" },
      });
    }
    if (request.method === "GET") {
      const url = new URL(pathname, process.env.API_PUBLIC_URL ?? "http://localhost:3001").href;
      const { row, bytes } = await readPrivateAttachment(actor, url);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": row.mimeType,
          "content-length": String(bytes.length),
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
          "content-disposition": `${row.mimeType.startsWith("image/") || row.mimeType === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
        },
      });
    }
    return Response.json({ error: "Metode tidak tersedia." }, { status: 405 });
  } catch (error: unknown) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Lampiran belum dapat diproses." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
