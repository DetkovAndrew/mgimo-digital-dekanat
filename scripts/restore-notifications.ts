// Вернуть студентам уведомления, которые они удалили у себя. Демо-аккаунты общие для жюри: перед показом и между
// проверками, вместе с `npm run db:undo-staff`. `-- --dry-run` — только посчитать.
// На сервере: `docker compose run --rm tools npm run db:restore-notifications`.
import { prisma } from "../src/server/db";

export async function restoreHiddenNotifications({ dryRun = false } = {}) {
  const where = { hiddenAt: { not: null } };
  return dryRun ? prisma.notificationRecipient.count({ where }) : (await prisma.notificationRecipient.updateMany({ where, data: { hiddenAt: null } })).count;
}

if (process.argv[1]?.endsWith("restore-notifications.ts")) {
  const dryRun = process.argv.includes("--dry-run");
  restoreHiddenNotifications({ dryRun })
    .then((n) => console.log(`${dryRun ? "Будет возвращено" : "Возвращено"} удалённых уведомлений: ${n}.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
