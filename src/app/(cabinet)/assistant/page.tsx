import { PageTitle } from "@/components/ui";
import { isAssistantConfigured } from "@/server/ai/gigachat";
import { requireStudent } from "@/server/session";
import { Chat } from "./chat";

export default async function AssistantPage() {
  const { userId } = await requireStudent();
  return (
    <>
      <PageTitle sub="Отвечает GigaChat по данным вашего кабинета. Может ошибаться: сверяйтесь с разделами.">Спросить</PageTitle>
      {/* key: при смене аккаунта компонент пересоздаётся, история прежнего пользователя исчезает. */}
      <Chat key={userId} owner={userId} configured={isAssistantConfigured()} />
    </>
  );
}
