/**
 * Adaptador da Anthropic (Claude). Lista modelos via `GET /v1/models` — a mesma
 * chamada valida a chave. Autenticação por `x-api-key` + `anthropic-version`.
 */

import {
  buscarJson,
  erroDeStatus,
  postJson,
  IAError,
  type ModeloIA,
  type PedidoResposta,
} from "@/lib/ia/provedores";

const BASE = "https://api.anthropic.com";
const VERSAO = "2023-06-01";
const MAX_TOKENS = 1024;

interface ModeloBruto {
  id?: unknown;
  display_name?: unknown;
}

export async function listarModelosClaude(apiKey: string): Promise<ModeloIA[]> {
  const { status, data } = await buscarJson(`${BASE}/v1/models?limit=100`, {
    "x-api-key": apiKey,
    "anthropic-version": VERSAO,
  });
  if (status >= 400) throw erroDeStatus(status);

  const lista = (data as { data?: ModeloBruto[] }).data ?? [];
  return lista
    .filter((m): m is ModeloBruto & { id: string } => typeof m.id === "string")
    .map((m) => ({ id: m.id, nome: typeof m.display_name === "string" ? m.display_name : m.id }));
}

/** `POST /v1/messages`. O `system` vai no campo próprio; o resto são turnos. */
export async function gerarRespostaClaude(pedido: PedidoResposta): Promise<string> {
  const { status, data } = await postJson(
    `${BASE}/v1/messages`,
    { "x-api-key": pedido.apiKey, "anthropic-version": VERSAO },
    {
      model: pedido.modelo,
      max_tokens: MAX_TOKENS,
      system: pedido.system,
      messages: pedido.turnos.map((t) => ({ role: t.papel, content: t.texto })),
    },
  );
  if (status >= 400) throw erroDeStatus(status);

  const blocos = (data as { content?: { type?: string; text?: string }[] }).content ?? [];
  const texto = blocos
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!texto) throw new IAError("A IA não devolveu texto.");
  return texto;
}
