import { existsSync } from "node:fs";

// Все тесты работают только с тестовой БД, никогда с основной.
if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.TEST_DATABASE_URL) throw new Error("Задайте TEST_DATABASE_URL в .env");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
