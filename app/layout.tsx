import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Pedro",
  description: "ERP web multiempresa Pedro / Vax / Arles",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
