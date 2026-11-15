import "server-only";
import { z } from "zod";
import { isSkinUnlocked, SKIN_IDS, SKINS, type SkinId, skinById } from "@/lib/invictia/skins";
import { prisma } from "../db";
import { requireStudent } from "../session";
import { getMyAchievements } from "./achievements";

// Образ Инвиктии студента (src/lib/invictia/skins.ts). Владелец — только из сессии. Открыт ли образ, сервер проверяет
// при выборе по ачивкам; при показе (каждая страница кабинета) читается только сохранённое значение — дёшево.

export type SkinResult = { ok: true } | { ok: false; error: string };

/** Сохранённый образ для кнопки помощника и маршрута. Неизвестное значение — базовый. */
export async function getMySkinId(): Promise<SkinId> {
  const { studentId } = await requireStudent();
  const p = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { invictiaSkin: true } });
  return skinById(p.invictiaSkin).id;
}

/** Гардероб для профиля: выбранный образ и какие открыты. Открытость — по ачивкам текущего студента. */
export async function getMyWardrobe(): Promise<{ current: SkinId; unlocked: SkinId[] }> {
  const [current, flags] = await Promise.all([getMySkinId(), getMyAchievements()]);
  const unlocked = SKINS.filter((s) => isSkinUnlocked(s, flags)).map((s) => s.id);
  // Образ мог закрыться (например, пересдача в новой сессии) — тогда показываем и считаем выбранным базовый.
  return { current: unlocked.includes(current) ? current : "base", unlocked };
}

const skinSchema = z.enum(SKIN_IDS);

export async function setMySkin(input: unknown): Promise<SkinResult> {
  const parsed = skinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Такого образа нет" };
  const { studentId } = await requireStudent();
  const skin = skinById(parsed.data);
  if (!isSkinUnlocked(skin, await getMyAchievements())) return { ok: false, error: "Этот образ ещё не открыт" };
  await prisma.studentProfile.update({ where: { id: studentId }, data: { invictiaSkin: skin.id === "base" ? null : skin.id } });
  return { ok: true };
}
