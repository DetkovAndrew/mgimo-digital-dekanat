import Link from "next/link";

/** Постоянная ссылка на родительский раздел: работает и при открытии страницы по прямой ссылке. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="-ml-1 mb-2 inline-flex min-h-11 items-center px-1 text-sm text-brand">
      ← {children}
    </Link>
  );
}
