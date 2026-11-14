/** Собственный знак University (NursuUwU, public/brand/README.md): «U» и точка «i», без символики реальных вузов. */
export function UniversityMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="16" className="fill-brand-fill" />
      <path d="M14 14H23V35C23 42 27 46 32 46C37 46 41 42 41 35V27H50V35C50 47 43 55 32 55C21 55 14 47 14 35V14Z" className="fill-on-brand" />
      <rect x="41" y="12" width="9" height="9" rx="2" className="fill-on-brand" />
    </svg>
  );
}
