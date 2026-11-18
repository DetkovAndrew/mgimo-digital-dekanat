// Страница «Уже чиним» (scripts/down-page.tsx): Caddy отдаёт её, пока приложение не отвечает. Файл в deploy/errors
// собран из сцены Инвиктии и токенов темы: после их правки его нужно пересобрать (`npm run down-page`).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOWN_PAGE, downPageHtml } from "../scripts/down-page";

describe("страница перезапуска", () => {
  const html = readFileSync(DOWN_PAGE, "utf8");

  it("совпадает со сборкой из сцены и токенов", () => {
    expect(html).toBe(downPageHtml());
  });

  it("автономна: оговорка, единственный шаблон Caddy, без внешних скриптов и стилей", () => {
    expect(html).toContain("Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза. Все данные вымышлены.");
    expect(html.match(/\{\{/g)).toHaveLength(1);
    expect(html).toContain('{{placeholder "http.error.status_code"}}');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+stylesheet|https?:\/\//);
    expect(html).not.toMatch(/--[a-z0-9-]+:undefined/); // у каждого токена сцены есть значение
  });
});
