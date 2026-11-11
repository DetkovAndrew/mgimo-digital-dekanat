import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** Постоянная ссылка на родительский раздел: работает и при открытии страницы по прямой ссылке. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} transitionTypes={["nav-back"]} className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-0.5 pr-2 text-[15px] text-brand">
      <ChevronLeft aria-hidden className="size-5" />
      {children}
    </Link>
  );
}
