"use client";

import { type ErrorBoundaryProps, ErrorState } from "@/components/error-state";

// Сбой при загрузке раздела кабинета: меню, шапка и помощница остаются, можно повторить или уйти в другой раздел.
export default function CabinetError(props: ErrorBoundaryProps) {
  return <ErrorState {...props} />;
}
