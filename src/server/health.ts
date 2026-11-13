import "server-only";
import { prisma } from "./db";

/** База отвечает на простейший запрос. Для проверки живости (`/api/health`), без данных. */
export async function databaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
