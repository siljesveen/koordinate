import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KOordinate",
  description: "Kommandosentral for bemanning og ruteplanlegging",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
