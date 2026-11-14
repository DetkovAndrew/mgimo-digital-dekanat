// Тема оформления: светлая, тёмная или как в системе (по умолчанию). Выбор — настройка устройства, а не аккаунта:
// хранится в localStorage этого браузера. Тёмные токены — блок :root[data-theme="dark"] в globals.css.

export const THEME_KEY = "theme";
export const THEME_PREFS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

declare global {
  interface Window {
    /** Применить выбор (ставит скрипт темы из <head>). Без аргумента — сохранённый в браузере. */
    __applyTheme?: (pref?: ThemePref) => void;
  }
}

/**
 * Скрипт для <head>: выполняется до первой отрисовки, поэтому страница сразу в нужной теме, без вспышки.
 * Следит за сменой темы устройства и за выбором в соседних вкладках. Цвет панели браузера (meta theme-color)
 * при явном выборе следует теме сайта, а не устройства. Без JavaScript — светлая тема.
 */
export const themeScript = `(function () {
  var d = document.documentElement, m = window.matchMedia("(prefers-color-scheme: dark)"), chosen = null;
  // Выбор в этой вкладке важнее хранилища: при запрещённом localStorage тема всё равно переключается.
  function pref() { if (chosen) return chosen; try { return localStorage.getItem("${THEME_KEY}"); } catch (e) { return null; } }
  function apply() {
    var p = pref(), forced = p === "light" || p === "dark", dark = p === "dark" || (!forced && m.matches);
    d.setAttribute("data-theme", dark ? "dark" : "light");
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var el = metas[i], media = el.getAttribute("data-media");
      if (media === null) { media = el.getAttribute("media") || ""; el.setAttribute("data-media", media); }
      el.setAttribute("media", forced ? ((media.indexOf("dark") >= 0) === dark ? "all" : "not all") : media);
    }
  }
  apply();
  document.addEventListener("DOMContentLoaded", apply);
  if (m.addEventListener) m.addEventListener("change", apply);
  window.addEventListener("storage", function (e) { if (e.key === "${THEME_KEY}") { chosen = null; apply(); } });
  window.__applyTheme = function (p) { if (p) chosen = p; apply(); };
})();`;
