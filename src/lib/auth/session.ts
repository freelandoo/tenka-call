import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "tenka_session";
const DIAS = 7;

export async function criarSessao(userId: string): Promise<void> {
  const expiraEm = new Date(Date.now() + DIAS * 86_400_000);
  const s = await prisma.session.create({ data: { userId, expiraEm } });
  (await cookies()).set(COOKIE, s.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

/**
 * Usuário da requisição atual, ou null.
 * Relê o banco a cada chamada de propósito: desativar um atendente derruba o
 * acesso na hora, sem esperar a sessão expirar.
 */
export async function usuarioAtual() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiraEm < new Date()) return null;
  if (!s.user.ativo) return null;
  return s.user;
}

export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.session.delete({ where: { id } }).catch(() => {});
  jar.delete(COOKIE);
}
