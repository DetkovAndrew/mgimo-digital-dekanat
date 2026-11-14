import { BookOpenCheck, FileCheck2, IdCard, MessageCircleQuestion, Wallet, Wifi, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/format";
import type { RequestCategory } from "@/lib/requests/catalog";

/** Разделы каталога заявок: порядок на экране «Новая заявка», иконка и цвет строки в списках. */
export const REQUEST_GROUPS: readonly { category: RequestCategory; title: string; icon: LucideIcon; tone: Tone | "brand" }[] = [
  { category: "certificate", title: "Справки", icon: FileCheck2, tone: "info" },
  { category: "application", title: "Учебный процесс", icon: BookOpenCheck, tone: "brand" },
  { category: "status", title: "Статус и документы", icon: IdCard, tone: "neutral" },
  { category: "money", title: "Стипендия и выплаты", icon: Wallet, tone: "ok" },
  { category: "campus", title: "Кампус и IT", icon: Wifi, tone: "brand" },
  { category: "question", title: "Вопрос", icon: MessageCircleQuestion, tone: "warn" },
];

export const requestGroup = (category: RequestCategory) => REQUEST_GROUPS.find((g) => g.category === category) ?? REQUEST_GROUPS.at(-1)!;
