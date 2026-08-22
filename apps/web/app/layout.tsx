import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { MobileShell } from "@/components/layout/mobile-shell";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="id" className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-[16px] font-normal text-on-surface">
        <MobileShell>{children}</MobileShell>
        <Toaster position="top-center" offset={72} mobileOffset={72} richColors />
      </body>
    </html>
  );
}
