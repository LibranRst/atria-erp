/** Cross-app links preserve the mobile browser fallback while admin is separate. */
export function atriaWebHref(
  path = "/",
  origin = process.env.NEXT_PUBLIC_ATRIA_WEB_URL ?? "http://localhost:3000",
): string {
  const base = new URL(origin);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_ATRIA_WEB_URL harus menggunakan HTTP atau HTTPS.");
  }
  const target = new URL(path, base.origin);
  if (target.origin !== base.origin)
    throw new Error("Tujuan Atria harus berada pada origin web yang dikonfigurasi.");
  target.searchParams.set("surface", "mobile");
  return target.toString();
}
