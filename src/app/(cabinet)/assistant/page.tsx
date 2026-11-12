import { redirect } from "next/navigation";

// Помощник открывается кружком в углу любого экрана (src/components/assistant.tsx); старые ссылки ведут на «Сегодня».
export default function AssistantPage() {
  redirect("/today");
}
