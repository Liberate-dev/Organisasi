import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rundown Builder",
  description: "Buat, edit, dan ekspor rundown acara organisasi mahasiswa.",
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

