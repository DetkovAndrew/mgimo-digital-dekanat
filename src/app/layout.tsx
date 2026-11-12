import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
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
    <html lang="ru" data-scroll-behavior="smooth" className={`${onest.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
