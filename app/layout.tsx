import type { Metadata } from "next";
import { Manrope, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { MobileShell } from "@/components/layout/mobile-shell";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
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
    <html
      lang="en"
      className={`${manrope.variable} ${hanken.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        {/* Material Symbols is the current icon font for the mobile shell. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[#fcf9f8] font-body-md text-on-surface">
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
