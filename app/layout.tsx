import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIA · Lotus Intelligent Assistant",
  description: "Your Vietnam Airlines travel companion. Plan trips, compare offers and find your way home.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
