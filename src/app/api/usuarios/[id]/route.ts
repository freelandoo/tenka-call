import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { definirAtivoRepo, definirSenhaRepo } from "@/lib/repositories/usuarios";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof corpo.ativo === "boolean") {
    if (id === g.user.id && !corpo.ativo) {
      return NextResponse.json({ erro: "não é possível desativar a si mesmo" }, { status: 400 });
    }
    // Usuário de outra empresa cai aqui como "não encontrado": 404, não 403.
    const mexeu = await definirAtivoRepo(g.user.orgId, id, corpo.ativo);
    if (!mexeu) return NextResponse.json({ erro: "usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (typeof corpo.senha === "string") {
    if (corpo.senha.length < 8) {
      return NextResponse.json({ erro: "a senha precisa de ao menos 8 caracteres" }, { status: 400 });
    }
    const mexeu = await definirSenhaRepo(g.user.orgId, id, corpo.senha, true);
    if (!mexeu) return NextResponse.json({ erro: "usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "nada a alterar" }, { status: 400 });
}
