import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rundown Builder MVP",
  description: "Frontend simulation for mahasiswa organization rundown builder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

