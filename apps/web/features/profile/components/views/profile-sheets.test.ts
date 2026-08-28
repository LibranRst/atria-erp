import { describe, expect, test } from "bun:test";

/**
 * Sheet dirender ke portal, jadi `renderToStaticMarkup` mengembalikan string
 * kosong dan tidak bisa dipakai menguji isinya — sama seperti taksonomi dialog
 * di `components/ui/overlay/dialogs.test.ts`. Yang dikunci di sini adalah
 * keputusan-keputusan yang mudah tergerus diam-diam saat file ini disunting
 * lagi; perilaku murninya diuji sungguhan di `features/profile/utils/profile-form.test.ts`.
 */

const editSheetPath = new URL("./edit-profile-sheet.tsx", import.meta.url);
const passwordSheetPath = new URL("./change-password-sheet.tsx", import.meta.url);
const identityPath = new URL("./profile-identity-surface.tsx", import.meta.url);
const providerPath = new URL("./profile-actions-provider.tsx", import.meta.url);

describe("sheet ubah profil", () => {
  test("memakai jalur unggah bersama, bukan fetch ImageKit sendiri", async () => {
    const source = await Bun.file(editSheetPath).text();

    expect(source).toContain("uploadToImageKit");
    expect(source).toContain('folder: "/user-avatars"');
    expect(source).not.toContain("upload.imagekit.io");
    expect(source).not.toContain("publicKey");
  });

  test("gambar dikecilkan di klien sebelum diunggah", async () => {
    const source = await Bun.file(editSheetPath).text();

    expect(source).toContain("cropImageToSquareJpeg");
  });

  test("galat unggah tinggal di dalam sheet, bukan sebagai toast yang hilang", async () => {
    const source = await Bun.file(editSheetPath).text();
    const catchBlock = source.slice(
      source.indexOf("} catch (error: unknown) {"),
      source.indexOf("} finally {"),
    );

    // Toast menghilang sementara sheet masih terbuka; galat unggah harus
    // bertahan di tempat pengguna sedang bekerja.
    expect(catchBlock).toContain("setUploadError");
    expect(catchBlock).not.toContain("toast.error");
    expect(source).toContain('role={uploadError ? "alert" : "status"}');
    expect(source).toContain("Coba lagi");
  });

  test("galat tampil sebagai teks bernada, bukan kartu galat tersendiri", async () => {
    const source = await Bun.file(editSheetPath).text();

    // DESIGN.md: galat adalah teks inline bernada di dekat kontrolnya —
    // sebuah kartu galat memindahkan masalahnya menjauh dari penyebabnya.
    expect(source).not.toContain("InlineStateRow");
    expect(source).not.toContain("GroupedSurface");
    expect(source).toContain("captionToneClass");
  });

  test("foto berdiri sebagai subjek di kanvas sheet, bukan baris di dalam panel", async () => {
    const source = await Bun.file(editSheetPath).text();
    const heroIndex = source.indexOf('aria-label="Foto profil"');
    const panelIndex = source.indexOf("<FormSection>");

    expect(heroIndex).toBeGreaterThan(-1);
    // Hero mendahului panel, dan panel hanya memuat nama.
    expect(heroIndex).toBeLessThan(panelIndex);
    expect(source.slice(panelIndex)).not.toContain("UserAvatar");
  });

  test("pemutar unggahan berhenti bersama unggahannya", async () => {
    const source = await Bun.file(editSheetPath).text();

    /*
     * `animate={... : undefined}` tidak menghentikan animasi yang sedang
     * berjalan — Framer membacanya sebagai "tidak ada target baru", sehingga
     * `repeat: Infinity` terus berputar setelah unggahan selesai. Nodenya harus
     * dilepas, bukan dibiarkan dengan target kosong.
     */
    expect(source).not.toMatch(/animate=\{[^}]*uploading[^}]*undefined\s*\}/);
    expect(source).toContain("{uploading ? (");
  });

  test("pratinjau objek URL selalu dicabut kembali", async () => {
    const source = await Bun.file(editSheetPath).text();

    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
  });

  test("bilah atas dan halaman profil sama-sama disegarkan setelah simpan", async () => {
    const source = await Bun.file(editSheetPath).text();

    // Bilah atas membaca sesi klien; halaman profil dirender server.
    expect(source).toContain("await refetch()");
    expect(source).toContain("router.refresh()");
  });

  test("aturan nama tidak ditulis ulang di dalam komponen", async () => {
    const source = await Bun.file(editSheetPath).text();

    expect(source).toContain("getDisplayNameError");
    expect(source).not.toContain("length < 2");
  });
});

describe("sheet ganti password", () => {
  test("kebijakan password tidak ditulis ulang di dalam komponen", async () => {
    const source = await Bun.file(passwordSheetPath).text();

    expect(source).toContain("getNewPasswordError");
    expect(source).not.toMatch(/\/\[A-Z\]\//);
    expect(source).not.toContain("minimal 12 karakter");
  });

  test("pencabutan sesi perangkat lain diberitahukan sebelum submit", async () => {
    const source = await Bun.file(passwordSheetPath).text();
    const statusText = source.slice(source.indexOf("statusText="), source.indexOf("onClose="));

    expect(statusText).toContain("Perangkat lain akan keluar otomatis");
    expect(statusText).toContain("Perangkat ini tetap masuk");
  });
});

describe("pemicu sheet", () => {
  test("avatar menjadi tombol hanya bila ada provider yang memiliki sheet-nya", async () => {
    const source = await Bun.file(identityPath).text();

    expect(source).toContain("useProfileActions()");
    expect(source).toContain("actions.openEditProfile");
    expect(source).toContain('aria-label="Ubah profil"');
  });

  test("kedua sheet dirender satu kali di satu tempat", async () => {
    const source = await Bun.file(providerPath).text();

    expect(source.match(/<EditProfileSheet/g)).toHaveLength(1);
    expect(source.match(/<ChangePasswordSheet/g)).toHaveLength(1);
    // State direset dengan memasang ulang, bukan dengan membersihkan manual.
    expect(source).toContain("key={`edit-${editSession}`}");
  });
});
