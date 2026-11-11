import { Disclaimer } from "@/components/disclaimer";
import { Bell, Logo, Nav, ProfileLink } from "@/components/nav";
import { RouteMotion } from "@/components/route-motion";
import { Toaster } from "@/components/toast";
import { countMyUnread } from "@/server/dal/notifications";
import { requireStudent } from "@/server/session";

export default async function CabinetLayout({ children }: LayoutProps<"/">) {
  await requireStudent();
  const unread = await countMyUnread();
  return (
    <div className="flex min-h-dvh">
      <Nav unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div style={{ viewTransitionName: "app-header" }} className="sticky top-0 z-20 md:static">
          <Disclaimer />
          <header className="flex items-center justify-between border-b border-hairline bg-surface/90 py-1 pr-1 pl-4 backdrop-blur-xl md:hidden">
            <span className="flex items-center gap-2 font-semibold">
              <span className="scale-[0.8]">
                <Logo />
              </span>
              University
            </span>
            <span className="flex items-center">
              <Bell unread={unread} />
              <ProfileLink />
            </span>
          </header>
        </div>
        <Toaster />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28 md:pt-8 md:pb-12">
          <RouteMotion>{children}</RouteMotion>
        </main>
      </div>
    </div>
  );
}
