import { NextResponse, after } from "next/server";
import { processarEventoWhatsapp, resumoParaLog, type EventoWebhook } from "@/lib/whatsapp/ingest";
import { responderAuto } from "@/lib/whatsapp/autoresposta";

/**
 * Webhook da Evolution API. Grava o evento (ingestão) e, SÓ com o atendente
 * automático ligado, gera e envia a resposta pelo `responderAuto` — o único
 * caminho de envio a partir daqui. A ingestão (`ingest.ts`) permanece sem
 * alcançar o envio; o teste de arquitetura (`sem-automacao.test.ts`) garante que
 * só `autoresposta.ts` importa o módulo de envio.
 *
 * A empresa sai da instância do evento. Esta rota é pública por natureza: quem
 * autentica é o `x-webhook-secret`. Em produção sem secret configurado ela se
 * recusa a funcionar (503) em vez de aceitar qualquer um.
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
    // Ingestão primeiro: a resposta automática lê o histórico que ela grava.
    try {
      await processarEventoWhatsapp(evento);
    } catch (e) {
      console.error("[whatsapp] falha ao processar webhook", resumoParaLog(evento), e);
    }
    // Envio automático isolado: erro do provedor de IA não desfaz a gravação.
    try {
      await responderAuto(evento);
    } catch (e) {
      console.error("[whatsapp] falha na resposta automática", resumoParaLog(evento), e);
    }
  });

  return NextResponse.json({ recebido: true });
}
