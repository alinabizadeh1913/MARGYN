import type { Metadata } from "next";
import "../styles/globals.css";
import AppShell from "@/components/AppShell";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "MARGYN",
  description: "Read, don't count. Mindful reading with a writable margin.",
  applicationName: "MARGYN",
  other: { version: "1.0.0" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased bg-nm-deep text-nm-text overflow-hidden select-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
