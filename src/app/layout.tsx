import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Деканат University",
  description: "Концепт личного кабинета студента. Не является официальным сервисом какого-либо вуза.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3b4cca" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
