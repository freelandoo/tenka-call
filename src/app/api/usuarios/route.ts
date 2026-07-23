import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { listarUsuariosRepo, criarUsuarioRepo } from "@/lib/repositories/usuarios";
import type { Role } from "@prisma/client";

export async function GET() {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;
  return NextResponse.json({ usuarios: await listarUsuariosRepo(g.user.orgId) });
}

export async function POST(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const login = typeof corpo.login === "string" ? corpo.login.trim() : "";
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  const role: Role = corpo.role === "ADMIN" ? "ADMIN" : "ATENDENTE";

  if (!login || !nome) return NextResponse.json({ erro: "informe login e nome" }, { status: 400 });
  if (!/^[a-z0-9._-]+$/i.test(login)) {
    return NextResponse.json({ erro: "login aceita letras, números, ponto, _ e -" }, { status: 400 });
  }
  if (senha.length < 8) {
    return NextResponse.json({ erro: "a senha precisa de ao menos 8 caracteres" }, { status: 400 });
  }

  try {
    const criado = await criarUsuarioRepo(g.user.orgId, { login, nome, role, senha });
    return NextResponse.json({ id: criado.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha ao criar";
    return NextResponse.json({ erro: msg }, { status: msg === "login já em uso" ? 409 : 500 });
  }
}
