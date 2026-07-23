import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { definirSenhaRepo } from "@/lib/repositories/usuarios";

export async function POST(req: Request) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const atual = typeof corpo.atual === "string" ? corpo.atual : "";
  const nova = typeof corpo.nova === "string" ? corpo.nova : "";

  if (nova.length < 8) {
    return NextResponse.json(
      { erro: "a nova senha precisa de ao menos 8 caracteres" },
      { status: 400 },
    );
  }
  if (nova === atual) {
    return NextResponse.json(
      { erro: "a nova senha precisa ser diferente da atual" },
      { status: 400 },
    );
  }

  const dono = await prisma.user.findUniqueOrThrow({ where: { id: g.user.id } });
  if (!(await verifyPassword(dono.passwordHash, atual))) {
    return NextResponse.json({ erro: "senha atual incorreta" }, { status: 400 });
  }

  await definirSenhaRepo(g.user.orgId, g.user.id, nova, false);
  return NextResponse.json({ ok: true });
}
