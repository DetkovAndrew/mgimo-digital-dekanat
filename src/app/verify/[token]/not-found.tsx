import { SearchX } from "lucide-react";
import { VerifyShell } from "../shell";

// Неверный формат и неизвестный токен неразличимы: одна страница, HTTP 404.
export default function CertificateNotFound() {
  return (
    <VerifyShell>
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-hairline">
        <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
          <SearchX className="size-7" />
        </span>
        <h1 className="mb-2 text-title font-semibold">Справка не найдена</h1>
        <p className="text-body text-ink-2">
          В демо-реестре нет справки с такой ссылкой. Проверьте, что адрес скопирован полностью, или отсканируйте QR-код
          ещё раз.
        </p>
      </div>
    </VerifyShell>
  );
}
