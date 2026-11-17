import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { isPublicAuthPath } from "@/server/auth-paths";

const handler = toNextJsHandler(auth);

// Наружу — только вход, выход и проверка сессии (src/server/auth-paths.ts); остальное Better Auth отвечает 404.
const only = (run: (req: Request) => Promise<Response>) => (req: Request) =>
  isPublicAuthPath(new URL(req.url).pathname) ? run(req) : Promise.resolve(new Response("Not Found", { status: 404 }));

export const GET = only(handler.GET);
export const POST = only(handler.POST);
