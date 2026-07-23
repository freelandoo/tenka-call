import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { criarSessao } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { login?: unknown; senha?: unknown };
  const login = typeof corpo.login === "string" ? corpo.login.trim().toLowerCase() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";

  if (!login || !senha) {
    return NextResponse.json({ erro: "informe login e senha" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  const ok = user ? await verifyPassword(user.passwordHash, senha) : false;

  // Mesma mensagem para usuário inexistente, senha errada e conta desativada:
  // não conta a quem tenta qual dos três aconteceu.
  if (!user || !ok || !user.ativo) {
    return NextResponse.json({ erro: "login ou senha inválidos" }, { status: 401 });
  }

  await criarSessao(user.id);
  return NextResponse.json({
    destino: user.senhaProvisoria ? "/perfil" : rotaInicial(user.role as Papel),
  });
}
