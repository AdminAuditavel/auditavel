//app/layout.tsx

// app/layout.tsx
'use client';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactDndProvider from "../components/ReactDndProvider";
import AccessLogger from "@/app/components/AccessLogger"; // Importando o AccessLogger
import { usePathname } from "next/navigation"; // Hook para pegar o pathname
import { metadata } from './metadata'; // Importando a metadata

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Verificar se estamos na página de uma pesquisa (por exemplo, /poll/[id])
  const pollId = pathname.includes("/poll/") ? pathname.split("/poll/")[1] : null;

  return (
    <html lang="pt-BR">
      <head>
        {/* A metadata está sendo aplicada agora */}
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* O provedor ReactDndProvider ajuda com o gerenciamento de arrastos e ordenações */}
        <ReactDndProvider>
          {/* Incluindo o AccessLogger no layout se a página for uma pesquisa */}
          {pollId && <AccessLogger pollId={pollId} />}
          {children}
        </ReactDndProvider>
      </body>
    </html>
  );
}
