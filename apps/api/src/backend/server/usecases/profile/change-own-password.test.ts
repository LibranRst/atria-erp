import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(APP_ROOT, relativePath), "utf8");
}

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

  return source.slice(start, index + 1);
}

describe("changeOwnPassword transaction integrity", () => {
  const useCaseSource = readSource("server/usecases/profile/change-own-password.ts");
  const body = extractTransactionBody(useCaseSource);

  test("hash baru, pencabutan sesi, dan audit berada dalam satu transaksi", () => {
    expect(body).toContain(".update(account)");
    expect(body).toContain("password: newHash");
    expect(body).toContain(".delete(session)");
    expect(body).toContain('action: "CHANGE_OWN_PASSWORD"');
  });

  test("sesi pemanggil dikecualikan dari pencabutan", () => {
    /*
     * Preseden `changeTemporaryPassword` menulis `ne(session.id, "")`, yang
     * tidak pernah menyaring apa pun sehingga seluruh sesi terhapus. Perilaku
     * itu benar di sana — formulirnya memang menutup dengan `signOut()` — tetapi
     * salah di sini, dan bentuknya cukup mirip untuk tersalin tanpa sengaja.
     */
    expect(body).toContain("ne(session.id, actor.sessionId)");
    expect(body).not.toContain('ne(session.id, "")');
  });

  test("verifikasi kata sandi lama terjadi sebelum transaksi dibuka", () => {
    const verifyIndex = useCaseSource.indexOf("context.password.verify");
    const transactionIndex = useCaseSource.indexOf("await db.transaction(");

    expect(verifyIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeLessThan(transactionIndex);
  });

  test("hashing tetap milik Better Auth, bukan implementasi sendiri", () => {
    expect(useCaseSource).toContain("context.password.hash");
    expect(useCaseSource).not.toContain("createHash");
  });

  test("tidak ada identitas yang berasal dari argumen klien", () => {
    expect(useCaseSource).not.toMatch(/input\.(userId|actorId|id)\b/);
    expect(useCaseSource).toContain("actor.userId");
  });

  test("Server Action web memakai use-case yang sama, bukan salinan transaksi", () => {
    const actionSource = readSource("app/actions/profile/change-own-password.ts");

    expect(actionSource).toContain("changeOwnPasswordUseCase");
    expect(actionSource).not.toContain("db.transaction");
    expect(actionSource).toContain("resolveActor()");
  });
});

describe("updateOwnProfile audit integrity", () => {
  const useCaseSource = readSource("server/usecases/profile/update-own-profile.ts");

  test("jalur manual memakai writer transaksi yang sama dengan AI", () => {
    const body = extractTransactionBody(useCaseSource);
    expect(body).toContain("updateOwnProfileTx(tx, actor, input)");
    const writer =
      useCaseSource
        .split("export async function updateOwnProfileTx")[1]
        ?.split("export async function updateOwnProfileUseCase")[0] ?? "";
    expect(writer).toContain(".update(user)");
    expect(writer).toContain('action: "UPDATE_OWN_PROFILE"');
    expect(writer).not.toMatch(/db\.(insert|update)/);
  });
  test("submit tanpa perubahan keluar sebelum update dan audit", () => {
    const earlyReturnIndex = useCaseSource.indexOf("updated: false, auditId: null");
    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(earlyReturnIndex).toBeLessThan(useCaseSource.indexOf(".update(user)"));
  });

  test("tidak ada identitas yang berasal dari argumen klien", () => {
    expect(useCaseSource).not.toMatch(/input\.(userId|actorId|id)\b/);
    expect(useCaseSource).toContain("actor.userId");
  });
});
