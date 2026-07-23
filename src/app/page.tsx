import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";

export default async function Home() {
  const user = await usuarioAtual();
  redirect(user ? rotaInicial(user.role as Papel) : "/login");
}
