import { getMyPassPage } from "@/server/dal/pass";
import { PassCard } from "./pass-card";

export const dynamic = "force-dynamic";

export default async function PassPage() {
  const data = await getMyPassPage();
  return <PassCard key={data.owner} {...data} />;
}
