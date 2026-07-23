import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/session";
import { podePapel, rotaInicial, type Papel } from "@/lib/auth/papeis";

/** Guard de página: sem sessão vai para o login. */
export async function exigirUsuario() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return user;
}

/** Guard de página por papel: quem não tem cai na própria tela inicial. */
export async function exigirPapel(exigidos: Papel[]) {
  const user = await exigirUsuario();
  if (!podePapel(user.role as Papel, exigidos)) redirect(rotaInicial(user.role as Papel));
  return user;
}

/**
 * Guard de rota /api. Uso:
 *   const g = await exigirSessaoApi();
 *   if (g.erro) return g.erro;
 *   // g.user disponível, com g.user.orgId para escopar a query
 */
export async function exigirSessaoApi() {
  const user = await usuarioAtual();
  if (!user) {
    return { user: null as null, erro: NextResponse.json({ erro: "não autenticado" }, { status: 401 }) };
  }
  return { user, erro: null as null };
}

/** Como exigirSessaoApi, mas exige ADMIN. */
export async function exigirAdminApi() {
  const g = await exigirSessaoApi();
  if (g.erro || !g.user) return g;
  if (!podePapel(g.user.role as Papel, ["ADMIN"])) {
    return { user: null as null, erro: NextResponse.json({ erro: "apenas ADMIN" }, { status: 403 }) };
  }
  return g;
}
