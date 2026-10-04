import { NotificationsProvider } from "@/features/notifications";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { PwaRegistrar } from "@/components/layout/pwa-registrar";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { resolveActor } from "@/server/actor";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finance ERP",
  description: "Finance-first control room for interior contractors",
  applicationName: "Atria ERP",
  manifest: "/manifest.webmanifest",
  /*
   * Tiga meta iOS ini yang membuat Atria terbuka penuh layar dari Layar Utama
   * dan memakai namanya sendiri di bawah ikon. `statusBarStyle` tetap `default`
   * karena kanvasnya terang; gaya `black-translucent` akan menaruh isi di bawah
   * jam dan notch, dan shell ini belum menangani `env(safe-area-inset-top)`.
   */
  appleWebApp: {
    capable: true,
    title: "Atria",
    statusBarStyle: "default",
  },
  /*
   * Next 16 hanya memancarkan `mobile-web-app-capable` dari `capable: true`.
   * iOS 16.3 ke bawah masih membaca nama lama `apple-mobile-web-app-capable`,
   * dan tanpa itu pemasangan ke Layar Utama membuka Atria di dalam Safari —
   * `PushManager` tidak pernah muncul di sana.
   */
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    /*
     * Berkasnya sengaja tidak memakai konvensi `app/apple-icon.*` supaya seluruh
     * ikon PWA berada di satu tempat, `public/icons/`.
     */
    apple: "/icons/apple-touch-icon.png",
  },
};

/**
 * `interactive-widget: resizes-content` menyusutkan layout viewport saat papan
 * ketik terbuka, bukan menimpanya.
 *
 * Tanpa ini, setiap elemen `fixed bottom` di aplikasi — komposer chat dan panel
 * input AI yang lebih tinggi — tertutup papan ketik di Android. Ini setelan
 * seluruh aplikasi, bukan hanya layar chat: rute lain dengan elemen melekat di
 * bawah ikut terpengaruh, dan itu memang yang diinginkan.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // Token yang sama dengan `--ios-canvas` dan `background_color` manifest.
  themeColor: "#f5f5f7",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  /*
   * Diselesaikan di layout, sekali per request: seluruh pohon klien membaca
   * izin yang sama dengan yang ditegakkan server pada request itu juga.
   * `resolveActor` mengembalikan `null` pada halaman publik (login, setup),
   * dan daftar kosong di sana memang jawaban yang benar.
   */
  const actor = await resolveActor();
  const initialUser = actor
    ? { id: actor.userId, name: actor.name, image: actor.image ?? null }
    : null;

  return (
    <html lang="id" className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-[16px] font-normal text-on-surface">
        <PermissionsProvider permissions={actor?.permissions ?? []} user={initialUser}>
          <NotificationsProvider>
            <WorkspaceShell>{children}</WorkspaceShell>
          </NotificationsProvider>
        </PermissionsProvider>
        <PwaRegistrar />
        <Toaster position="top-center" offset={72} mobileOffset={72} richColors />
      </body>
    </html>
  );
}
