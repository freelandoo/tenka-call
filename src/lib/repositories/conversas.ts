import { prisma } from "@/lib/db";
import { chaveTelefone, formatarTelefone, telefoneDoJid } from "@/lib/whatsapp/telefone";
import type { ConversaInteresse, Prisma } from "@prisma/client";

/**
 * Mapa fixo classificação → funil. "Sem interesse" cai em `qualificado` de
 * propósito: a pessoa conversou e foi qualificada, mas não quer agora — é a
 * lista de reativação. `perdido` é o descarte definitivo, com motivo.
 */
export const INTERESSE_ESTAGIO = {
  nao_classificado: "novo",
  com_interesse: "interesse",
  sem_interesse: "qualificado",
  perdido: "perdido",
  convertido: "convertido",
} as const;

export interface RegistroItem {
  id: string;
  usuario: string;
  interesse: ConversaInteresse;
  observacao: string | null;
  criadoEm: string;
}

export interface ConversaResumo {
  id: string;
  nome: string;
  telefone: string;
  temTelefone: boolean;
  leadId: string | null;
  instanciaId: string;
  instanciaNome: string;
  atendente: string | null;
  interesse: ConversaInteresse;
  naoLidas: number;
  ultimaMensagemEm: string;
  preview: string;
  ultimoRegistro: Omit<RegistroItem, "id"> | null;
}

export interface MensagemItem {
  id: string;
  direcao: "IN" | "OUT";
  autor: "LEAD" | "ATENDENTE";
  autorNome: string | null;
  texto: string;
  tipoMidia: string;
  enviadaEm: string;
  erro: string | null;
}

/** Violação de unique — usada para tratar reentrega do webhook como no-op. */
function ehDuplicata(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// ─── Conversa ─────────────────────────────────────────────────────────────────

/**
 * Acha o lead dono do número **dentro da empresa**. Compara pelos últimos 8
 * dígitos para atravessar DDI e 9º dígito — ver `chaveTelefone`. A coluna
 * `ultimos8` é indexada: o match não varre a tabela, e não cruza empresas.
 */
async function acharLeadPorTelefone(orgId: string, telefone: string): Promise<string | null> {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  const achado = await prisma.lead.findFirst({
    where: { orgId, ultimos8: chave },
    select: { id: true },
    orderBy: { criadoEm: "asc" },
  });
  return achado?.id ?? null;
}

/**
 * Garante conversa e lead para um número que escreveu.
 * Número já conhecido na empresa é vinculado, nunca duplicado.
 */
export async function garantirConversaRepo(input: {
  orgId: string;
  instanciaId: string;
  remoteJid: string;
  pushName: string;
}) {
  const existente = await prisma.conversa.findUnique({
    where: { instanciaId_remoteJid: { instanciaId: input.instanciaId, remoteJid: input.remoteJid } },
  });
  if (existente) {
    // pushName muda quando a pessoa troca o nome do perfil; mantém o mais recente.
    if (input.pushName && input.pushName !== existente.pushName) {
      return prisma.conversa.update({
        where: { id: existente.id },
        data: { pushName: input.pushName },
      });
    }
    return existente;
  }

  const telefone = telefoneDoJid(input.remoteJid);
  let leadId = telefone ? await acharLeadPorTelefone(input.orgId, telefone) : null;

  if (!leadId) {
    const lead = await prisma.lead.create({
      data: {
        orgId: input.orgId,
        nome: input.pushName || formatarTelefone(telefone) || "Contato do WhatsApp",
        telefone,
        ultimos8: chaveTelefone(telefone),
        origem: "whatsapp",
        estagio: "novo",
      },
      select: { id: true },
    });
    leadId = lead.id;
  }

  return prisma.conversa.create({
    data: {
      orgId: input.orgId,
      instanciaId: input.instanciaId,
      remoteJid: input.remoteJid,
      telefone,
      pushName: input.pushName || null,
      leadId,
    },
  });
}

const RESUMO_INCLUDE = {
  lead: { select: { id: true, nome: true, telefone: true } },
  atendente: { select: { nome: true } },
  instancia: { select: { id: true, nome: true } },
  // O último registro entra na própria consulta da lista: a tela mostra quem
  // atendeu por último sem uma ida ao banco por linha.
  atendimentos: {
    take: 1,
    orderBy: { criadoEm: "desc" },
    include: { user: { select: { nome: true } } },
  },
} satisfies Prisma.ConversaInclude;

type ConversaComResumo = Prisma.ConversaGetPayload<{ include: typeof RESUMO_INCLUDE }>;

function toResumo(c: ConversaComResumo): ConversaResumo {
  const ultimo = c.atendimentos[0];
  return {
    id: c.id,
    nome: c.lead?.nome || c.pushName || formatarTelefone(c.telefone) || c.remoteJid,
    telefone: formatarTelefone(c.telefone || c.lead?.telefone),
    temTelefone: !!c.telefone,
    leadId: c.leadId,
    instanciaId: c.instanciaId,
    instanciaNome: c.instancia.nome,
    atendente: c.atendente?.nome ?? null,
    interesse: c.interesse,
    naoLidas: c.naoLidas,
    ultimaMensagemEm: c.ultimaMensagemEm.toISOString(),
    preview: c.ultimaMensagemPreview,
    ultimoRegistro: ultimo
      ? {
          usuario: ultimo.user.nome,
          interesse: ultimo.interesse,
          observacao: ultimo.observacao,
          criadoEm: ultimo.criadoEm.toISOString(),
        }
      : null,
  };
}

export async function listarConversasRepo(
  orgId: string,
  filtros: { instanciaId?: string } = {},
): Promise<ConversaResumo[]> {
  const rows = await prisma.conversa.findMany({
    where: { orgId, ...(filtros.instanciaId ? { instanciaId: filtros.instanciaId } : {}) },
    include: RESUMO_INCLUDE,
    orderBy: { ultimaMensagemEm: "desc" },
    take: 200,
  });
  return rows.map(toResumo);
}

export async function obterConversaRepo(orgId: string, id: string): Promise<ConversaResumo | null> {
  const row = await prisma.conversa.findFirst({ where: { id, orgId }, include: RESUMO_INCLUDE });
  return row ? toResumo(row) : null;
}

/** Telefone cru e instância para envio — o resumo só devolve o formato de exibição. */
export function dadosEnvioConversaRepo(orgId: string, id: string) {
  return prisma.conversa.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      telefone: true,
      atendenteId: true,
      instancia: { select: { evolutionInstance: true, status: true } },
    },
  });
}

/** False quando a conversa não existe ou é de outra empresa. */
export async function marcarConversaLidaRepo(orgId: string, id: string): Promise<boolean> {
  const r = await prisma.conversa.updateMany({ where: { id, orgId }, data: { naoLidas: 0 } });
  return r.count > 0;
}

export async function assumirConversaRepo(orgId: string, id: string, userId: string): Promise<boolean> {
  const r = await prisma.conversa.updateMany({ where: { id, orgId }, data: { atendenteId: userId } });
  return r.count > 0;
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

export async function listarMensagensRepo(
  orgId: string,
  conversaId: string,
  depois?: Date,
): Promise<MensagemItem[]> {
  // `gte`, não `gt`: o WhatsApp marca o tempo em segundos, e duas mensagens no
  // mesmo segundo do cursor seriam perdidas para sempre. O cliente deduplica por id.
  const rows = await prisma.mensagem.findMany({
    where: {
      conversa: { id: conversaId, orgId },
      ...(depois ? { enviadaEm: { gte: depois } } : {}),
    },
    include: { autorUser: { select: { nome: true } } },
    orderBy: { enviadaEm: "asc" },
    take: 500,
  });
  return rows.map((m) => ({
    id: m.id,
    direcao: m.direcao,
    autor: m.autor,
    autorNome: m.autorUser?.nome ?? null,
    texto: m.texto,
    tipoMidia: m.tipoMidia,
    enviadaEm: m.enviadaEm.toISOString(),
    erro: m.erro,
  }));
}

/**
 * Grava a mensagem e atualiza o resumo da conversa na mesma transação.
 * `waMessageId` é unique: reentrega da Evolution vira no-op silencioso.
 * Devolve `false` quando era duplicata — ou quando a conversa não é da empresa.
 */
export async function registrarMensagemRepo(
  orgId: string,
  input: {
    conversaId: string;
    waMessageId: string;
    direcao: "IN" | "OUT";
    autor: "LEAD" | "ATENDENTE";
    autorUserId?: string | null;
    texto: string;
    tipoMidia?: string;
    enviadaEm?: Date;
    erro?: string | null;
  },
): Promise<boolean> {
  const conversa = await prisma.conversa.findFirst({
    where: { id: input.conversaId, orgId },
    select: { id: true },
  });
  if (!conversa) return false;

  const enviadaEm = input.enviadaEm ?? new Date();
  try {
    await prisma.$transaction([
      prisma.mensagem.create({
        data: {
          conversaId: conversa.id,
          waMessageId: input.waMessageId,
          direcao: input.direcao,
          autor: input.autor,
          autorUserId: input.autorUserId ?? null,
          texto: input.texto,
          tipoMidia: input.tipoMidia ?? "texto",
          enviadaEm,
          erro: input.erro ?? null,
        },
      }),
      prisma.conversa.update({
        where: { id: conversa.id },
        data: {
          ultimaMensagemEm: enviadaEm,
          ultimaMensagemPreview: input.texto.slice(0, 140),
          ...(input.direcao === "IN" ? { naoLidas: { increment: 1 } } : { naoLidas: 0 }),
        },
      }),
    ]);
    return true;
  } catch (e) {
    if (ehDuplicata(e)) return false;
    throw e;
  }
}

// ─── Classificação (cadastro de atendimento) ──────────────────────────────────

/**
 * Registra o atendimento e propaga a classificação para o funil do lead.
 * O registro é append-only: fica o histórico de quem classificou o quê.
 */
export async function classificarConversaRepo(
  orgId: string,
  input: {
    conversaId: string;
    userId: string;
    interesse: ConversaInteresse;
    observacao?: string;
    motivoPerdido?: string;
  },
): Promise<ConversaResumo | null> {
  const conversa = await prisma.conversa.findFirst({
    where: { id: input.conversaId, orgId },
    select: { id: true, leadId: true },
  });
  if (!conversa) return null;

  const estagio = INTERESSE_ESTAGIO[input.interesse];

  await prisma.$transaction([
    prisma.conversa.update({
      where: { id: conversa.id },
      data: { interesse: input.interesse, atendenteId: input.userId },
    }),
    prisma.atendimentoRegistro.create({
      data: {
        orgId,
        conversaId: conversa.id,
        userId: input.userId,
        interesse: input.interesse,
        observacao: input.observacao?.trim() || null,
      },
    }),
    // Sempre reflete no funil: o estágio do lead acompanha a conversa, inclusive
    // quando a equipe volta atrás na classificação.
    ...(conversa.leadId
      ? [
          prisma.lead.update({
            where: { id: conversa.leadId },
            data: {
              estagio,
              motivoPerdido:
                input.interesse === "perdido" ? input.motivoPerdido?.trim() || "Sem interesse" : null,
            },
          }),
        ]
      : []),
  ]);

  return obterConversaRepo(orgId, conversa.id);
}

export async function listarAtendimentosRepo(
  orgId: string,
  conversaId: string,
): Promise<RegistroItem[]> {
  const rows = await prisma.atendimentoRegistro.findMany({
    where: { conversaId, orgId },
    include: { user: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    usuario: r.user.nome,
    interesse: r.interesse,
    observacao: r.observacao,
    criadoEm: r.criadoEm.toISOString(),
  }));
}
