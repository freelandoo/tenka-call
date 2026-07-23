/**
 * Adaptador da OpenAI. Lista modelos via `GET /v1/models` (valida a chave na
 * mesma chamada). Autenticação por `Authorization: Bearer`.
 */

import {
  buscarJson,
  erroDeStatus,
  postJson,
  IAError,
  type ModeloIA,
  type PedidoResposta,
} from "@/lib/ia/provedores";

const BASE = "https://api.openai.com";
const MAX_TOKENS = 1024;

interface ModeloBruto {
  id?: unknown;
}

/** Só modelos de chat interessam ao atendimento — a lista da OpenAI traz muita coisa. */
function ehModeloDeChat(id: string): boolean {
  return /^(gpt|o[0-9]|chatgpt)/i.test(id) && !/(embedding|whisper|tts|dall-e|audio|image|realtime|moderation)/i.test(id);
}

export async function listarModelosOpenai(apiKey: string): Promise<ModeloIA[]> {
  const { status, data } = await buscarJson(`${BASE}/v1/models`, {
    Authorization: `Bearer ${apiKey}`,
  });
  if (status >= 400) throw erroDeStatus(status);

  const lista = (data as { data?: ModeloBruto[] }).data ?? [];
  return lista
    .filter((m): m is ModeloBruto & { id: string } => typeof m.id === "string")
    .filter((m) => ehModeloDeChat(m.id))
    .map((m) => ({ id: m.id, nome: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** `POST /v1/chat/completions`. O `system` vira o primeiro turno de papel system. */
export async function gerarRespostaOpenai(pedido: PedidoResposta): Promise<string> {
  const { status, data } = await postJson(
    `${BASE}/v1/chat/completions`,
    { Authorization: `Bearer ${pedido.apiKey}` },
    {
      model: pedido.modelo,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: pedido.system },
        ...pedido.turnos.map((t) => ({ role: t.papel, content: t.texto })),
      ],
    },
  );
  if (status >= 400) throw erroDeStatus(status);

  const escolha = (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0];
  const texto = typeof escolha?.message?.content === "string" ? escolha.message.content.trim() : "";
  if (!texto) throw new IAError("A IA não devolveu texto.");
  return texto;
}
