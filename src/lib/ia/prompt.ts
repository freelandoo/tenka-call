/**
 * Monta o system prompt do atendente automático a partir do playbook e do
 * estágio atual da conversa. Todo o "conhecimento do negócio" vem daqui — a IA
 * não deve inventar preço ou serviço que não esteja no contexto.
 */

import type { FechoTipo } from "@prisma/client";

export interface PlaybookPrompt {
  objetivo: string | null;
  contexto: string | null;
  saudacaoAtiva: boolean;
  desenvolvimentoAtiva: boolean;
  agendamentoAtiva: boolean;
  fecho: FechoTipo;
  linkFecho: string | null;
  servicos: { nome: string; preco: string; descricao: string | null }[];
}

export type Estagio = "saudacao" | "desenvolvimento" | "agendamento" | "encerrado";

/** Ordem dos estágios ativos. Sempre termina em `encerrado` (nada mais a fazer). */
export function sequenciaEstagios(pb: PlaybookPrompt): Estagio[] {
  const seq: Estagio[] = [];
  if (pb.saudacaoAtiva) seq.push("saudacao");
  if (pb.desenvolvimentoAtiva) seq.push("desenvolvimento");
  if (pb.agendamentoAtiva) seq.push("agendamento");
  seq.push("encerrado");
  return seq;
}

/** Estágio da vez a partir de quantas mensagens automáticas já saíram. */
export function estagioAtual(pb: PlaybookPrompt, iaMensagens: number): Estagio {
  const seq = sequenciaEstagios(pb);
  return seq[Math.min(iaMensagens, seq.length - 1)];
}

function listaServicos(pb: PlaybookPrompt): string {
  if (!pb.servicos.length) return "(nenhum serviço cadastrado)";
  return pb.servicos
    .map((s) => `- ${s.nome}${s.preco ? ` — ${s.preco}` : ""}${s.descricao ? `: ${s.descricao}` : ""}`)
    .join("\n");
}

function instrucaoEstagio(pb: PlaybookPrompt, estagio: Estagio): string {
  switch (estagio) {
    case "saudacao":
      return "ESTÁGIO: saudação. Cumprimente de forma calorosa, apresente-se como a Tenka em uma frase, desperte interesse e pergunte se a pessoa teria interesse em saber mais. Ainda não fale de preço.";
    case "desenvolvimento":
      return "ESTÁGIO: desenvolvimento. Apresente o serviço e o valor a partir da lista de serviços/preços, mostre o benefício e contorne objeção com naturalidade. Use só os preços cadastrados.";
    case "agendamento":
      return pb.fecho === "link"
        ? `ESTÁGIO: fecho por link. Convide a pessoa a se cadastrar e mande o link: ${pb.linkFecho || "(link não configurado — peça o contato para enviar depois)"}.`
        : "ESTÁGIO: fecho por reunião. Proponha agendar uma reunião rápida, ofereça sugerir um horário e confirme o melhor momento para a pessoa.";
    case "encerrado":
      return "ESTÁGIO: encerramento. O roteiro terminou. Seja breve, coloque-se à disposição e não force. Se a pessoa perguntar algo, responda com base no contexto.";
  }
}

export function montarSystemPrompt(pb: PlaybookPrompt, estagio: Estagio, interesse: number): string {
  return [
    "Você é um atendente comercial da Tenka no WhatsApp. Fale em português do Brasil, em tom humano, cordial e direto.",
    "Regras: responda em UMA mensagem curta (no máximo 2 ou 3 frases), como no WhatsApp. Nunca invente preço, serviço ou promessa que não esteja no CONTEXTO ou na lista de serviços. Se não souber, ofereça encaminhar para um atendente. Não repita a saudação se a conversa já começou.",
    pb.objetivo ? `OBJETIVO DO ATENDIMENTO: ${pb.objetivo}` : "",
    `SERVIÇOS E PREÇOS:\n${listaServicos(pb)}`,
    pb.contexto ? `CONTEXTO DO NEGÓCIO:\n${pb.contexto}` : "",
    `INTERESSE ESTIMADO DO LEAD: ${interesse}/100.`,
    instrucaoEstagio(pb, estagio),
  ]
    .filter(Boolean)
    .join("\n\n");
}
