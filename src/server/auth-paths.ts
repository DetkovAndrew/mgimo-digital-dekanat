// Какие эндпоинты Better Auth открыты по HTTP. Учётные записи выдаёт вуз (у нас — seed), поэтому студенту
// и сотруднику нужны только вход, выход и проверка сессии. Остальное закрыто: смена пароля и логина, сессии
// других устройств, сброс пароля, соцсети. Иначе эксперт с общим демо-паролем мог бы сменить пароль или логин
// для всех остальных. Новые эндпоинты Better Auth после обновления тоже закрыты, пока их не добавят сюда.

export const AUTH_BASE_PATH = "/api/auth";

export const PUBLIC_AUTH_PATHS: ReadonlySet<string> = new Set(["/sign-in/username", "/sign-out", "/get-session"]);

/** Адрес запроса ведёт к разрешённому эндпоинту: точное совпадение пути, без раскодирования и лишних «/». */
export function isPublicAuthPath(pathname: string): boolean {
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return false;
  return PUBLIC_AUTH_PATHS.has(pathname.slice(AUTH_BASE_PATH.length));
}
