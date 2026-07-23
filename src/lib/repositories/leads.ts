import { prisma } from "@/lib/db";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import type { LeadEstagio } from "@prisma/client";

/**
 * Banco de leads da empresa. Todo contato que escreve no WhatsApp já vira lead
 * em `garantirConversaRepo`, e a classificação do inbox propaga o `estagio` aqui
 * (ver `classificarConversaRepo`). Esta tela é a leitura desse funil.
 */

export interface LeadResumo {
  id: string;
  nome: string;
  telefone: string;
  /** Só dígitos — para montar o link do WhatsApp externo. */
  telefoneCru: string;
  origem: string;
  estagio: LeadEstagio;
  motivoPerdido: string | null;
  observacao: string | null;
  criadoEm: string;
  /**
   * Conversa mais recente do lead, quando existe. Com conversa, responder é por
   * dentro (o histórico fica registrado); sem conversa, só resta o WhatsApp por fora.
   */
  conversaId: string | null;
}

const RESUMO_INCLUDE = {
  // A conversa mais recente basta para o botão "Responder"; o lead pode ter mais
  // de uma (mesmo número em instâncias diferentes), mas a tela leva a uma delas.
  conversas: {
    take: 1,
    orderBy: { ultimaMensagemEm: "desc" },
    select: { id: true },
  },
} as const;

/**
 * Lista os leads da empresa, do mais novo para o mais antigo. O filtro por
 * estágio e a contagem por chip ficam no cliente: são poucos leads por empresa
 * e o filtro instantâneo não justifica uma ida ao banco por clique.
 */
export async function listarLeadsRepo(orgId: string): Promise<LeadResumo[]> {
  const rows = await prisma.lead.findMany({
    where: { orgId },
    include: RESUMO_INCLUDE,
    orderBy: { criadoEm: "desc" },
    take: 1000,
  });

  return rows.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefone: formatarTelefone(l.telefone),
    telefoneCru: l.telefone,
    origem: l.origem,
    estagio: l.estagio,
    motivoPerdido: l.motivoPerdido,
    observacao: l.observacao,
    criadoEm: l.criadoEm.toISOString(),
    conversaId: l.conversas[0]?.id ?? null,
  }));
}
