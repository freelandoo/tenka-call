import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { exigirSessaoApi } from "@/lib/auth/guards";
import {
  assumirConversaRepo,
  dadosEnvioConversaRepo,
  listarMensagensRepo,
  registrarMensagemRepo,
} from "@/lib/repositories/conversas";
import { configEvolution, enviarTexto, EvolutionError } from "@/lib/whatsapp/evolution";
import { semConfig } from "@/lib/whatsapp/respostas";

export const dynamic = "force-dynamic";

const LIMITE_TEXTO = 4096; // limite prático de uma mensagem de texto do WhatsApp

/** GET — polling da thread aberta. `?depois=<ISO>` devolve só o delta. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  const bruto = new URL(req.url).searchParams.get("depois");
  const depois = bruto ? new Date(bruto) : undefined;
  const valido = depois && !Number.isNaN(depois.getTime()) ? depois : undefined;

  // Conversa de outra empresa devolve lista vazia: o escopo está no repositório.
  return NextResponse.json({ mensagens: await listarMensagensRepo(g.user.orgId, id, valido) });
}

/**
 * POST — resposta manual do atendente. **Único caminho de envio da aplicação**:
 * exige sessão, e portanto um clique humano. O webhook não chega aqui.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { texto?: string };
  const texto = String(body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });
  if (texto.length > LIMITE_TEXTO) {
    return NextResponse.json({ erro: "Mensagem longa demais." }, { status: 400 });
  }

  const cfg = configEvolution();
  if (!cfg) return semConfig();

  const conversa = await dadosEnvioConversaRepo(g.user.orgId, id);
  if (!conversa) return NextResponse.json({ erro: "conversa não encontrada" }, { status: 404 });
  if (conversa.instancia.status !== "CONNECTED") {
    return NextResponse.json(
      { erro: "WhatsApp desconectado. Conecte a instância antes de responder." },
      { status: 409 },
    );
  }
  if (!conversa.telefone) {
    return NextResponse.json(
      { erro: "Esta conversa não expõe o número; responda pelo aparelho." },
      { status: 409 },
    );
  }

  // Quem responde primeiro assume o atendimento.
  if (!conversa.atendenteId) {
    await assumirConversaRepo(g.user.orgId, id, g.user.id).catch(() => undefined);
  }

  try {
    const waId = await enviarTexto(cfg, conversa.instancia.evolutionInstance, conversa.telefone, texto);
    // Sem id do WhatsApp não há como deduplicar o eco do webhook; o prefixo
    // "local:" deixa isso explícito no banco.
    await registrarMensagemRepo(g.user.orgId, {
      conversaId: id,
      waMessageId: waId ?? `local:${randomUUID()}`,
      direcao: "OUT",
      autor: "ATENDENTE",
      autorUserId: g.user.id,
      texto,
    });
    return NextResponse.json({ mensagens: await listarMensagensRepo(g.user.orgId, id) });
  } catch (e) {
    // Guarda a bolha marcada como falha em vez de perder o texto digitado.
    await registrarMensagemRepo(g.user.orgId, {
      conversaId: id,
      waMessageId: `local:${randomUUID()}`,
      direcao: "OUT",
      autor: "ATENDENTE",
      autorUserId: g.user.id,
      texto,
      erro: e instanceof Error ? e.message.slice(0, 200) : "falha no envio",
    }).catch(() => undefined);

    if (e instanceof EvolutionError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    console.error("[whatsapp] falha ao enviar", e);
    return NextResponse.json({ erro: "Falha ao enviar a mensagem." }, { status: 502 });
  }
}
