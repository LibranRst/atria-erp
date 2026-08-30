/**
 * Menyediakan tiruan `next/navigation` supaya loader bisa diukur di luar Next.
 *
 * Beberapa loader halaman menarik `lib/server/session`, yang lewat Better Auth
 * sampai ke `next/navigation`. Modul itu membangun React context saat diimpor,
 * dan di bawah `--conditions react-server` React tidak menyediakan
 * `createContext` — jadi impornya melempar sebelum satu query pun jalan.
 *
 * Yang ditiru hanya hook navigasi milik komponen klien. Loader tidak pernah
 * memanggilnya; keberadaannya saja yang dibutuhkan agar modulnya bisa dimuat.
 * Tidak ada satu pun jalur data yang diganti, jadi angka yang diukur tetap
 * angka query yang sebenarnya.
 *
 * Dipakai hanya oleh `bun run perf:loaders`. Jangan dipakai untuk test —
 * `scripts/test-preload.ts` yang mengurus itu.
 */
import { plugin } from "bun";

plugin({
  name: "stub-next-navigation",
  setup(build) {
    build.module("next/navigation", () => ({
      exports: {
        useRouter: () => ({}),
        usePathname: () => "/",
        useSearchParams: () => new URLSearchParams(),
        redirect: () => undefined,
        notFound: () => undefined,
      },
      loader: "object",
    }));
  },
});
