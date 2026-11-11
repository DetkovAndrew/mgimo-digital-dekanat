// Локальный PostgreSQL для разработки и тестов без Docker и sudo.
// Запуск: `npm run db` (работает на переднем плане, Ctrl+C — остановка).
// Параметры подключения берутся из .env (DATABASE_URL), см. .env.example.
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Скопируйте .env.example в .env и заполните значения.");
  process.exit(1);
}

const { hostname, port, username, password, pathname } = new URL(url);
if (hostname !== "127.0.0.1" && hostname !== "localhost") {
  console.error(`npm run db запускает только локальную БД, а DATABASE_URL указывает на ${hostname}.`);
  process.exit(1);
}

// PostgreSQL требует права 0700 на каталог данных. DrvFS (диск C: в WSL) их не хранит,
// поэтому по умолчанию данные лежат в домашнем каталоге Linux, а не в папке проекта.
const dataDir = path.resolve(
  process.env.PG_DATA_DIR ?? path.join(homedir(), ".local/share/digital-dekanat/postgres"),
);
const databases = [pathname.slice(1), ...(process.env.PG_EXTRA_DATABASES ?? "").split(",")]
  .map((name) => name.trim())
  .filter(Boolean);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  port: Number(port || 5432),
  user: decodeURIComponent(username),
  password: decodeURIComponent(password),
  authMethod: "scram-sha-256",
  persistent: true,
  // Windows PostgreSQL не принимает Unix-имя локали C.UTF-8; кодировка остаётся UTF-8.
  initdbFlags: ["--encoding=UTF8", `--locale=${process.platform === "win32" ? "C" : "C.UTF-8"}`],
  postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
  onLog: () => {},
});

async function main() {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log(`Создаю кластер PostgreSQL в ${dataDir}`);
    mkdirSync(path.dirname(dataDir), { recursive: true });
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  for (const name of databases) {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) {
      await pg.createDatabase(name);
      console.log(`Создана БД ${name}`);
    }
  }
  await client.end();

  console.log(`PostgreSQL слушает 127.0.0.1:${port}; БД: ${databases.join(", ")}. Ctrl+C — остановить.`);
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
