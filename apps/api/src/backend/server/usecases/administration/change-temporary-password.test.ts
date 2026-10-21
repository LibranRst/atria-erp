import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

/**
 * Snapshot badan `db.transaction` dari Server Action lama, persis seperti isinya
 * sebelum diekstrak ke use-case (`app/actions/administration-staff.ts`).
 *
 * Sengaja dibekukan sebagai fixture, bukan dibaca dari `git show HEAD`: begitu
 * pekerjaan ini di-commit, HEAD berubah dan pembanding berbasis git akan
 * membandingkan file dengan dirinya sendiri — yaitu berhenti menguji apa pun.
 *
 * Satu-satunya perbedaan yang diizinkan terhadap use-case adalah substitusi
 * identitas `actor.id` → `actor.userId` sesuai kontrak `Actor`. Kalau ada
 * selisih lain, guardrail transaksi sudah didrift dan test ini harus merah.
 */
const ORIGINAL_TRANSACTION_BODY = `
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx
      .update(user)
      .set({ mustChangePassword: false, temporaryPasswordIssuedAt: null, updatedAt: new Date() })
      .where(eq(user.id, actor.id));
    await tx.delete(session).where(and(eq(session.userId, actor.id), ne(session.id, "")));
    await tx.insert(auditLog).values({
      userId: actor.id,
      action: "CHANGE_TEMPORARY_PASSWORD",
      targetTable: "user",
      targetId: actor.id,
      newState: JSON.stringify({ mustChangePassword: false }),
    });
  });
`;

function extractTransactionBody(source: string): string {
  const start = source.indexOf("await db.transaction(");
  expect(start).toBeGreaterThan(-1);

  // Hitung kurung sampai seimbang supaya blok bersarang ikut terambil utuh.
  let depth = 0;
  let index = source.indexOf("(", start);
  for (; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  return source.slice(start, index + 1) + source.slice(index + 1, source.indexOf(";", index) + 1);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("changeTemporaryPassword transaction integrity", () => {
  const useCaseSource = readFileSync(
    path.join(APP_ROOT, "server/usecases/administration/change-temporary-password.ts"),
    "utf8",
  );

  test("badan transaksi identik dengan sumber lama setelah substitusi identitas", () => {
    const expected = normalize(ORIGINAL_TRANSACTION_BODY).replaceAll("actor.id", "actor.userId");
    const actual = normalize(extractTransactionBody(useCaseSource));

    expect(actual).toBe(expected);
  });

  test("transaksi menulis keempat efek yang wajib dalam satu blok", () => {
    const body = extractTransactionBody(useCaseSource);

    expect(body).toContain(".update(account)");
    expect(body).toContain("mustChangePassword: false");
    expect(body).toContain(".delete(session)");
    expect(body).toContain('action: "CHANGE_TEMPORARY_PASSWORD"');
  });

  test("tidak ada identitas yang berasal dari argumen klien", () => {
    // Identitas hanya boleh dibaca dari `Actor` yang sudah diselesaikan server.
    expect(useCaseSource).not.toMatch(/input\.(userId|actorId|id)\b/);
    expect(useCaseSource).toContain("actor.userId");
  });

  test("Server Action web memakai use-case yang sama, bukan salinan transaksi", () => {
    const actionSource = readFileSync(
      path.join(APP_ROOT, "app/actions/administration-staff.ts"),
      "utf8",
    );
    const changeFunction = actionSource.slice(
      actionSource.indexOf("export async function changeTemporaryPassword"),
    );

    expect(changeFunction).toContain("changeTemporaryPasswordUseCase");
    expect(changeFunction).not.toContain("db.transaction");
    expect(changeFunction).toContain("resolveActor()");
  });
});
