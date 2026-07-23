import { prisma } from "@/lib/db";
import type { IAProvedor } from "@prisma/client";

/**
 * Config da IA por instância. A `apiKey` é segredo: as leituras públicas devolvem
 * só `temChave` (boolean), nunca a chave em si.
 */

export interface IAConfigPublico {
  instanciaId: string;
  ativo: boolean;
  provedor: IAProvedor | null;
  modelo: string | null;
  temChave: boolean;
}

function toPublico(c: {
  instanciaId: string;
  ativo: boolean;
  provedor: IAProvedor | null;
  modelo: string | null;
  apiKey: string | null;
}): IAConfigPublico {
  return {
    instanciaId: c.instanciaId,
    ativo: c.ativo,
    provedor: c.provedor,
    modelo: c.modelo,
    temChave: !!c.apiKey,
  };
}

/** Estado default de uma instância que ainda não configurou a IA. */
function vazio(instanciaId: string): IAConfigPublico {
  return { instanciaId, ativo: false, provedor: null, modelo: null, temChave: false };
}

export async function obterIAConfigRepo(
  orgId: string,
  instanciaId: string,
): Promise<IAConfigPublico | null> {
  const inst = await prisma.instancia.findFirst({
    where: { id: instanciaId, orgId },
    select: { id: true, iaConfig: true },
  });
  if (!inst) return null; // instância de outra empresa ou inexistente
  return inst.iaConfig ? toPublico(inst.iaConfig) : vazio(instanciaId);
}

/** Chave crua para o servidor gerar resposta — nunca exposta por rota de leitura. */
export async function obterChaveIARepo(orgId: string, instanciaId: string) {
  const c = await prisma.iAConfig.findFirst({
    where: { instanciaId, orgId, ativo: true },
    select: { provedor: true, apiKey: true, modelo: true },
  });
  if (!c || !c.provedor || !c.apiKey || !c.modelo) return null;
  return { provedor: c.provedor, apiKey: c.apiKey, modelo: c.modelo };
}

/**
 * Grava provedor + chave (o "Conectar"). Zera o modelo se o provedor mudou — os
 * modelos de um provedor não valem para o outro. Devolve false se a instância
 * não é da empresa.
 */
export async function salvarConexaoIARepo(
  orgId: string,
  instanciaId: string,
  provedor: IAProvedor,
  apiKey: string,
): Promise<boolean> {
  const inst = await prisma.instancia.findFirst({
    where: { id: instanciaId, orgId },
    select: { id: true, iaConfig: { select: { provedor: true } } },
  });
  if (!inst) return false;

  const trocouProvedor = inst.iaConfig?.provedor !== provedor;
  await prisma.iAConfig.upsert({
    where: { instanciaId },
    create: { instanciaId, orgId, provedor, apiKey },
    update: { provedor, apiKey, ...(trocouProvedor ? { modelo: null } : {}) },
  });
  return true;
}

/** Atualiza modelo e/ou liga-desliga. Não mexe na chave. */
export async function atualizarIAConfigRepo(
  orgId: string,
  instanciaId: string,
  dados: { modelo?: string | null; ativo?: boolean },
): Promise<IAConfigPublico | null> {
  const c = await prisma.iAConfig.findFirst({
    where: { instanciaId, orgId },
    select: { id: true },
  });
  if (!c) return null;

  const atualizado = await prisma.iAConfig.update({
    where: { id: c.id },
    data: {
      ...(dados.modelo !== undefined ? { modelo: dados.modelo } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
  return toPublico(atualizado);
}
