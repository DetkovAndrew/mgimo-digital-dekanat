"use client";

import { type ErrorBoundaryProps, ErrorState } from "@/components/error-state";

// Сбой в кабинете сотрудника: шапка с выходом остаётся. retry() заново запрашивает страницу у сервера.
export default function StaffError(props: ErrorBoundaryProps) {
  return <ErrorState {...props} title="Не удалось загрузить кабинет" home={{ href: "/staff", label: "К заявкам" }} />;
}
