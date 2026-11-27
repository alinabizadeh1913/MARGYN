import type { Metadata } from "next";
import "../styles/globals.css";
import AppShell from "@/components/AppShell";

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
    <html lang="en">
      <body className="antialiased bg-[#09080b] text-[#fbf8f9] overflow-hidden select-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
