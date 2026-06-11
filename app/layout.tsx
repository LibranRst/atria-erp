import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileShell } from "@/components/layout/mobile-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atria ERP",
  description: "Finance-first mobile operating system for interior contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-deep">
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
