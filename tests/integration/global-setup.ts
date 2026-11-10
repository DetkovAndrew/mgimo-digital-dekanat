import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Готовит тестовую БД: миграции + seed. Отказывается работать, если URL совпадает с основным. */
export default function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Задайте TEST_DATABASE_URL в .env");
  // Сравниваем адрес БД, а не строку целиком: параметры (?application_name=…) не должны обходить защиту.
  const target = (u: string) => {
    const x = new URL(u);
    return `${x.hostname}:${x.port || 5432}/${x.pathname.slice(1)}`;
  };
  const testDb = new URL(url).pathname.slice(1);
  if (!testDb.endsWith("_test")) throw new Error(`Тестовая БД должна называться *_test, а не ${testDb} — отказ`);
  if (process.env.DATABASE_URL && target(url) === target(process.env.DATABASE_URL)) {
    throw new Error("TEST_DATABASE_URL указывает на основную БД — отказ");
  }
  // Неразрушающее применение миграций + seed (он сам пересоздаёт демо-данные в этой БД).
  // `migrate reset` не используем: это разрушительная команда, ИИ-агент запускает её только с согласия человека.
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx prisma db seed", { stdio: "inherit", env });
}
