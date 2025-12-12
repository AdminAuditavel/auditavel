import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactDndProvider from "../components/ReactDndProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auditável — Pesquisa e Votação",
  description: "Sistema de pesquisa e votação com resultados ao vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* O provedor ReactDndProvider ajuda com o gerenciamento de arrastos e ordenações */}
        <ReactDndProvider>
          {children}
        </ReactDndProvider>
      </body>
    </html>
  );
}
