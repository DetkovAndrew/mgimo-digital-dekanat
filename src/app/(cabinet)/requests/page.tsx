import { DoorOpen } from "lucide-react";
import { IconTile, List, PageTitle, RowLink } from "@/components/ui";
import { requestCatalog } from "@/lib/requests/catalog";
import { requestGuide } from "@/lib/requests/guide";
import { listMyRequests } from "@/server/dal/requests";
import { RequestPicker } from "./request-picker";
import { DONE, RequestTabs } from "./tabs";

// Вкладка «Заявки»: каталог — сразу в разделе, без кнопки «Новая». Свои заявки и статусы — вкладка «Мои заявки».
export default async function RequestsCatalogPage() {
  const requests = await listMyRequests();
  return (
    <>
      <PageTitle sub="Справки, заявления и обращения в деканат. Статус придёт в уведомления.">Заявки</PageTitle>
      <RequestTabs current="catalog" active={requests.filter((r) => !DONE.has(r.status)).length} />
      <div className="mb-6">
        <List>
          <RowLink href="/rooms">
            <span className="flex items-center gap-3">
              <IconTile icon={DoorOpen} tone="ok" />
              <span className="min-w-0">
                <span className="block font-medium">Забронировать аудиторию</span>
                <span className="block text-xs text-ink-2">Коворкинги и переговорные: схема корпуса и свободное время</span>
              </span>
            </span>
          </RowLink>
        </List>
      </div>
      <RequestPicker
        items={Object.entries(requestCatalog).map(([key, s]) => ({ key, title: s.title, description: s.description, category: s.category, slaDays: s.slaDays, aka: requestGuide[key as keyof typeof requestGuide].aka.join(" ") }))}
      />
    </>
  );
}
