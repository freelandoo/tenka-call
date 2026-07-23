import { NextResponse, after } from "next/server";
import { processarEventoWhatsapp, resumoParaLog, type EventoWebhook } from "@/lib/whatsapp/ingest";

/**
 * Webhook da Evolution API. **Só grava — nunca responde ao lead.** O módulo que
 * envia (`@/lib/whatsapp/evolution`) não é alcançável a partir daqui, e há teste
 * de arquitetura (`sem-automacao.test.ts`) que falha se isso mudar.
 *
 * A empresa sai da instância do evento, dentro da ingestão. Esta rota é pública
 * por natureza: quem autentica é o `x-webhook-secret`. Em produção sem secret
 * configurado ela se recusa a funcionar (503) em vez de aceitar qualquer um.
 */
export async function POST(req: Request) {
  const esperado = (process.env.WHATSAPP_WEBHOOK_SECRET ?? "").trim();
  if (process.env.NODE_ENV === "production" && !esperado) {
    return NextResponse.json({ erro: "webhook secret não configurado" }, { status: 503 });
  }
  if (esperado && req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const evento = (await req.json().catch(() => null)) as EventoWebhook | null;
  if (!evento) return NextResponse.json({ recebido: true, ignorado: "corpo inválido" });

  // Responde já e processa depois: a Evolution não fica esperando o banco, e
  // falha nossa não vira retry infinito do lado dela. A reentrega continua sendo
  // segura de qualquer forma — `waMessageId` é unique.
  after(async () => {
    try {
      await processarEventoWhatsapp(evento);
    } catch (e) {
      console.error("[whatsapp] falha ao processar webhook", resumoParaLog(evento), e);
    }
  });

  return NextResponse.json({ recebido: true });
}
