import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MobileShell } from "@/components/layout/mobile-shell";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-[16px] leading-lg font-normal text-on-surface">
        <MobileShell>{children}</MobileShell>
        <Toaster position="top-center" offset={72} mobileOffset={72} richColors />
      </body>
    </html>
  );
}
