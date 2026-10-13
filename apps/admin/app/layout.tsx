import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Atria Admin", template: "%s · Atria Admin" },
  description: "Kontrol proyek dan budget Dekoria.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="id" data-theme="light">
      <body className="bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
