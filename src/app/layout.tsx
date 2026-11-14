import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

// Onest (OFL) — гротеск, нарисованный в первую очередь для кириллицы: ровный кернинг русского текста и табличные цифры.
const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Деканат University",
  description: "Концепт личного кабинета студента. Не является официальным сервисом какого-либо вуза.",
};

// Цвет панели браузера: метатег принимает только литерал, поэтому значения повторяют --surface из globals.css. ds-allow-hardcode
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" }, // ds-allow-hardcode
    { media: "(prefers-color-scheme: dark)", color: "#161925" }, // ds-allow-hardcode
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme ставит скрипт темы до гидрации — React не должен считать это расхождением.
    <html lang="ru" data-scroll-behavior="smooth" className={`${onest.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Тема до первой отрисовки (src/lib/theme.ts): без вспышки светлой страницы в тёмной теме. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
