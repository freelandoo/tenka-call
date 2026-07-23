/**
 * Adaptador da OpenAI. Lista modelos via `GET /v1/models` (valida a chave na
 * mesma chamada). Autenticação por `Authorization: Bearer`.
 */

import { buscarJson, erroDeStatus, type ModeloIA } from "@/lib/ia/provedores";

const BASE = "https://api.openai.com";

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
