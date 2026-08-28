import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { UserAvatar } from "./user-avatar";

const IMAGEKIT_URL = "https://ik.imagekit.io/dekoria/user-avatars/avatar-1.jpg";

describe("UserAvatar", () => {
  test("menampilkan inisial ketika tidak ada foto", () => {
    const html = renderToStaticMarkup(<UserAvatar initials="RW" renderPx={64} />);

    expect(html).toContain("RW");
    expect(html).not.toContain("<img");
  });

  test("meminta CDN mengirim ukuran render, bukan berkas 512 px penuh", () => {
    const html = renderToStaticMarkup(
      <UserAvatar imageUrl={IMAGEKIT_URL} initials="RW" displayName="Ronald" renderPx={40} />,
    );

    // 2× untuk layar retina.
    expect(html).toContain("tr=w-80,h-80");
  });

  test("permintaan CDN tidak pernah melebihi ukuran berkas yang diunggah", () => {
    const html = renderToStaticMarkup(
      <UserAvatar imageUrl={IMAGEKIT_URL} initials="RW" renderPx={512} />,
    );

    expect(html).toContain("tr=w-512,h-512");
  });

  test("URL di luar ImageKit dibiarkan apa adanya", () => {
    const html = renderToStaticMarkup(
      <UserAvatar imageUrl="https://example.com/foto.jpg" initials="RW" renderPx={64} />,
    );

    expect(html).not.toContain("tr=w-");
  });

  test("inisial disembunyikan dari pembaca layar saat foto tampil", () => {
    const html = renderToStaticMarkup(
      <UserAvatar imageUrl={IMAGEKIT_URL} initials="RW" displayName="Ronald" renderPx={64} />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Foto profil Ronald");
  });

  test("avatar tanpa nama bersifat dekoratif, bukan gambar tanpa keterangan", () => {
    // Bilah atas sudah punya label pada tautannya; alt kedua hanya kebisingan.
    const html = renderToStaticMarkup(
      <UserAvatar imageUrl={IMAGEKIT_URL} initials="RW" renderPx={40} />,
    );

    expect(html).toContain('alt=""');
  });
});
