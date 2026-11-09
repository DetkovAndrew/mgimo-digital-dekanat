import { redirect } from "next/navigation";
import { getCurrentRole } from "@/server/session";

export default async function Home() {
  const role = await getCurrentRole();
  if (role === "student") redirect("/today");
  if (role === "staff") redirect("/staff");
  redirect("/login");
}
