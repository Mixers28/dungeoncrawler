import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dungeon Portal",
  description: "Deterministic text-first dungeon crawler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
