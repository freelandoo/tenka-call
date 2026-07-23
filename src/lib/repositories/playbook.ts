import { prisma } from "@/lib/db";
import type { FechoTipo } from "@prisma/client";

/**
 * Playbook por instância: o roteiro que a IA segue. Uma leitura para a tela
 * (editar) e uma para o motor de resposta (gerar a fala).
 */

export interface ServicoItem {
  nome: string;
  preco: string;
  descricao: string | null;
}

export interface PlaybookPublico {
  instanciaId: string;
  objetivo: string;
  contexto: string;
  saudacaoAtiva: boolean;
  desenvolvimentoAtiva: boolean;
  agendamentoAtiva: boolean;
  fecho: FechoTipo;
  linkFecho: string;
  maxMensagensAuto: number;
  servicos: ServicoItem[];
}

const VAZIO = (instanciaId: string): PlaybookPublico => ({
  instanciaId,
  objetivo: "",
  contexto: "",
  saudacaoAtiva: true,
  desenvolvimentoAtiva: true,
  agendamentoAtiva: true,
  fecho: "reuniao",
  linkFecho: "",
  maxMensagensAuto: 8,
  servicos: [],
});

const INCLUDE_SERVICOS = { servicos: { orderBy: { ordem: "asc" } } } as const;

export async function obterPlaybookRepo(
  orgId: string,
  instanciaId: string,
): Promise<PlaybookPublico | null> {
  const inst = await prisma.instancia.findFirst({
    where: { id: instanciaId, orgId },
    select: { id: true, playbook: { include: INCLUDE_SERVICOS } },
  });
  if (!inst) return null;
  const p = inst.playbook;
  if (!p) return VAZIO(instanciaId);
  return {
    instanciaId,
    objetivo: p.objetivo ?? "",
    contexto: p.contexto ?? "",
    saudacaoAtiva: p.saudacaoAtiva,
    desenvolvimentoAtiva: p.desenvolvimentoAtiva,
    agendamentoAtiva: p.agendamentoAtiva,
    fecho: p.fecho,
    linkFecho: p.linkFecho ?? "",
    maxMensagensAuto: p.maxMensagensAuto,
    servicos: p.servicos.map((s) => ({ nome: s.nome, preco: s.preco, descricao: s.descricao })),
  };
}

export interface SalvarPlaybook {
  objetivo?: string;
  contexto?: string;
  saudacaoAtiva?: boolean;
  desenvolvimentoAtiva?: boolean;
  agendamentoAtiva?: boolean;
  fecho?: FechoTipo;
  linkFecho?: string;
  maxMensagensAuto?: number;
  servicos?: ServicoItem[];
}

/** Salva o playbook inteiro (upsert). Reescreve os serviços do zero — a lista é
 *  pequena e editada como um bloco. Devolve false se a instância não é da empresa. */
export async function salvarPlaybookRepo(
  orgId: string,
  instanciaId: string,
  dados: SalvarPlaybook,
): Promise<boolean> {
  const inst = await prisma.instancia.findFirst({
    where: { id: instanciaId, orgId },
    select: { id: true },
  });
  if (!inst) return false;

  const escalar = {
    ...(dados.objetivo !== undefined ? { objetivo: dados.objetivo.trim() || null } : {}),
    ...(dados.contexto !== undefined ? { contexto: dados.contexto.trim() || null } : {}),
    ...(dados.saudacaoAtiva !== undefined ? { saudacaoAtiva: dados.saudacaoAtiva } : {}),
    ...(dados.desenvolvimentoAtiva !== undefined
      ? { desenvolvimentoAtiva: dados.desenvolvimentoAtiva }
      : {}),
    ...(dados.agendamentoAtiva !== undefined ? { agendamentoAtiva: dados.agendamentoAtiva } : {}),
    ...(dados.fecho !== undefined ? { fecho: dados.fecho } : {}),
    ...(dados.linkFecho !== undefined ? { linkFecho: dados.linkFecho.trim() || null } : {}),
    ...(dados.maxMensagensAuto !== undefined
      ? { maxMensagensAuto: Math.max(1, Math.min(50, dados.maxMensagensAuto)) }
      : {}),
  };

  await prisma.$transaction(async (tx) => {
    const pb = await tx.playbook.upsert({
      where: { instanciaId },
      create: { instanciaId, orgId, ...escalar },
      update: escalar,
      select: { id: true },
    });
    if (dados.servicos) {
      await tx.playbookServico.deleteMany({ where: { playbookId: pb.id } });
      const limpos = dados.servicos
        .map((s, i) => ({
          playbookId: pb.id,
          nome: s.nome.trim(),
          preco: (s.preco ?? "").trim(),
          descricao: s.descricao?.trim() || null,
          ordem: i,
        }))
        .filter((s) => s.nome);
      if (limpos.length) await tx.playbookServico.createMany({ data: limpos });
    }
  });
  return true;
}

/** Playbook cru para o motor de resposta, resolvido pelo nome técnico da instância. */
export async function playbookParaRespostaRepo(instanciaId: string) {
  return prisma.playbook.findUnique({
    where: { instanciaId },
    include: INCLUDE_SERVICOS,
  });
}
