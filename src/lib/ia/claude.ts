/**
 * Adaptador da Anthropic (Claude). Lista modelos via `GET /v1/models` — a mesma
 * chamada valida a chave. Autenticação por `x-api-key` + `anthropic-version`.
 */

import { buscarJson, erroDeStatus, type ModeloIA } from "@/lib/ia/provedores";

const BASE = "https://api.anthropic.com";
const VERSAO = "2023-06-01";

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
