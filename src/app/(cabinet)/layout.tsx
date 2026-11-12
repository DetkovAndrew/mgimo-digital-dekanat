import { Disclaimer } from "@/components/disclaimer";
import { Assistant } from "@/components/assistant";
import { Bell, Logo, Nav, ProfileLink } from "@/components/nav";
import { RouteMotion } from "@/components/route-motion";
import { Toaster } from "@/components/toast";
import { isAssistantConfigured } from "@/server/ai/gigachat";
import { countMyUnread } from "@/server/dal/notifications";
import { requireStudent } from "@/server/session";

export default async function CabinetLayout({ children }: LayoutProps<"/">) {
  const { userId } = await requireStudent();
  const unread = await countMyUnread();
  return (
    <div className="flex min-h-dvh">
      <Nav unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Оговорка уезжает при прокрутке, шапка остаётся: экран телефона — для содержимого. */}
        <Disclaimer />
        <div style={{ viewTransitionName: "app-header" }} className="sticky top-0 z-20 md:hidden">
          <header className="flex items-center justify-between border-b border-hairline bg-surface/85 py-1 pr-1 pl-4 backdrop-blur-xl">
            <span className="flex items-center gap-2.5 text-lead font-bold tracking-tight">
              <Logo size={30} />
              University
            </span>
            <span className="flex items-center">
              <Bell unread={unread} />
              <ProfileLink />
            </span>
          </header>
        </div>
        <Toaster />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-44 md:pt-8 md:pb-28">
          <RouteMotion>{children}</RouteMotion>
        </main>
      </div>
      <Assistant owner={userId} configured={isAssistantConfigured()} />
    </div>
  );
}
