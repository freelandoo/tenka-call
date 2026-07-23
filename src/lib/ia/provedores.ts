/**
 * Adaptadores de provedor de IA. Cada provedor tem seu próprio jeito de listar
 * modelos e autenticar (Claude ≠ OpenAI), então cada um é um adaptador. Colar
 * "qualquer chave" só funciona para provedor que tenha adaptador aqui.
 *
 * Só o servidor fala com esses provedores: a `apiKey` nunca sai do servidor.
 */

import type { IAProvedor } from "@prisma/client";
import { listarModelosClaude } from "@/lib/ia/claude";
import { listarModelosOpenai } from "@/lib/ia/openai";

const TIMEOUT_MS = 15_000;

export class IAError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "IAError";
  }
}

export interface ModeloIA {
  id: string;
  nome: string;
}

/** Rótulos de tela dos provedores com adaptador. */
export const PROVEDOR_LABEL: Record<IAProvedor, string> = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
};

export function ehProvedor(valor: unknown): valor is IAProvedor {
  return valor === "claude" || valor === "openai";
}

/**
 * GET com timeout e erro amigável — compartilhado pelos adaptadores. Falha de
 * rede vira `IAError` em vez de derrubar a rota.
 */
export async function buscarJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; data: unknown }> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, signal: controle.signal, cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch (e) {
    const motivo = e instanceof Error && e.name === "AbortError" ? "tempo esgotado" : "sem resposta";
    throw new IAError(`Provedor de IA indisponível (${motivo}).`);
  } finally {
    clearTimeout(timer);
  }
}

/** Traduz o status HTTP do provedor em mensagem clara para a tela. */
export function erroDeStatus(status: number): IAError {
  if (status === 401 || status === 403) {
    return new IAError("Chave de API inválida ou sem permissão.", 400);
  }
  if (status === 429) return new IAError("Provedor recusou por limite de uso. Tente de novo.", 429);
  return new IAError("Falha ao falar com o provedor de IA.", 502);
}

/**
 * Valida a chave listando os modelos daquele provedor. Devolve os modelos para
 * a tela escolher; lança `IAError` se a chave não presta.
 */
export function listarModelos(provedor: IAProvedor, apiKey: string): Promise<ModeloIA[]> {
  const chave = apiKey.trim();
  if (!chave) throw new IAError("Informe a chave da API.", 400);

  switch (provedor) {
    case "claude":
      return listarModelosClaude(chave);
    case "openai":
      return listarModelosOpenai(chave);
    default:
      throw new IAError("Provedor sem adaptador.", 400);
  }
}
