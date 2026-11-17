import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Деканат University",
    short_name: "University",
    description: "Конкурсный концепт студенческого кабинета. Все данные вымышлены.",
    lang: "ru",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3b4cca",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    // Ярлыки установленного приложения (опрос 15–16.11: «вывести на главный экран… кьюар для входа»): долгое нажатие на
    // значок на телефоне, правая кнопка по значку на панели задач на компьютере (Chrome, Edge).
    shortcuts: [
      { name: "Пропуск", short_name: "Пропуск", description: "QR для турникета", url: "/pass", icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Расписание", short_name: "Расписание", description: "Занятия на неделю", url: "/schedule", icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
