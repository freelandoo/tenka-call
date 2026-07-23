import { NextResponse } from "next/server";
import { exigirSessaoApi } from "@/lib/auth/guards";
import {
  classificarConversaRepo,
  listarAtendimentosRepo,
  listarMensagensRepo,
  marcarConversaLidaRepo,
  obterConversaRepo,
} from "@/lib/repositories/conversas";
import { ehInteresse } from "@/lib/whatsapp/rotulos";

export const dynamic = "force-dynamic";

/** GET — conversa + histórico. Abrir a conversa zera o contador de não lidas. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  // Conversa de outra empresa cai aqui como "não encontrada": 404, não 403.
  const conversa = await obterConversaRepo(g.user.orgId, id);
  if (!conversa) return NextResponse.json({ erro: "conversa não encontrada" }, { status: 404 });

  const [mensagens, atendimentos] = await Promise.all([
    listarMensagensRepo(g.user.orgId, id),
    listarAtendimentosRepo(g.user.orgId, id),
  ]);
  await marcarConversaLidaRepo(g.user.orgId, id).catch(() => undefined);

  return NextResponse.json({ conversa: { ...conversa, naoLidas: 0 }, mensagens, atendimentos });
}

/** PATCH — classifica o atendimento e move o lead no funil. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    interesse?: unknown;
    observacao?: unknown;
    motivoPerdido?: unknown;
  };

  if (!ehInteresse(body.interesse)) {
    return NextResponse.json({ erro: "classificação inválida" }, { status: 400 });
  }

  const conversa = await classificarConversaRepo(g.user.orgId, {
    conversaId: id,
    userId: g.user.id,
    interesse: body.interesse,
    observacao: typeof body.observacao === "string" ? body.observacao : undefined,
    motivoPerdido: typeof body.motivoPerdido === "string" ? body.motivoPerdido : undefined,
  });
  if (!conversa) return NextResponse.json({ erro: "conversa não encontrada" }, { status: 404 });

  return NextResponse.json({
    conversa,
    atendimentos: await listarAtendimentosRepo(g.user.orgId, id),
  });
}
