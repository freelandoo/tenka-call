/**
 * Atendente automático: o ÚNICO caminho em que um evento recebido pode virar
 * mensagem enviada. É chamado pela ROTA do webhook, ao lado da ingestão — nunca
 * de dentro de `ingest.ts`, que continua sem alcançar o envio.
 *
 * DECISÃO DE PRODUTO CONSCIENTE (antes: "nunca responde sozinho"). O envio aqui
 * é cercado de travas: só com IA ligada e playbook configurado, respeitando o
 * limite de mensagens por conversa e o handoff para humano. Ver
 * `sem-automacao.test.ts`, que agora garante que só ESTE módulo importa o envio.
 */

import { porNomeTecnicoRepo } from "@/lib/repositories/instancias";
import { obterChaveIARepo } from "@/lib/repositories/iaConfig";
import { playbookParaRespostaRepo } from "@/lib/repositories/playbook";
import {
  avancarIAConversaRepo,
  estadoIAConversaRepo,
  listarMensagensRepo,
  pausarIAConversaRepo,
  registrarInteresseRepo,
  registrarMensagemRepo,
} from "@/lib/repositories/conversas";
import { configEvolution, enviarTexto } from "@/lib/whatsapp/evolution";
import { lerMensagem, mensagensDoEvento } from "@/lib/whatsapp/payload";
import { ehConversaPessoal } from "@/lib/whatsapp/telefone";
import { medirInteresse } from "@/lib/ia/interesse";
import { gerarResposta } from "@/lib/ia/provedores";
import { estagioAtual, montarSystemPrompt } from "@/lib/ia/prompt";
import type { EventoWebhook } from "@/lib/whatsapp/ingest";

/** Quantos turnos recentes mandar como histórico — o bastante para o contexto. */
const JANELA = 10;

export async function responderAuto(evento: EventoWebhook): Promise<void> {
  if (String(evento.event ?? "").toLowerCase() !== "messages.upsert") return;
  if (!evento.instance) return;

  const instancia = await porNomeTecnicoRepo(evento.instance);
  if (!instancia) return;

  // Uma resposta por evento: a primeira mensagem de lead que valha.
  for (const bruta of mensagensDoEvento(evento.data)) {
    const msg = lerMensagem(bruta);
    if (!msg) continue;
    if (msg.fromMe) continue; // nunca responde às próprias mensagens (sem loop)
    if (!ehConversaPessoal(msg.remoteJid)) continue;
    await tratar(instancia, msg.remoteJid, msg.texto);
    return;
  }
}

async function tratar(
  instancia: { id: string; orgId: string; evolutionInstance: string },
  remoteJid: string,
  textoLead: string,
): Promise<void> {
  const cfg = configEvolution();
  if (!cfg) return; // Evolution não configurada: não há como enviar

  const chave = await obterChaveIARepo(instancia.orgId, instancia.id);
  if (!chave) return; // IA desligada ou sem provedor/modelo/chave

  const pb = await playbookParaRespostaRepo(instancia.id);
  if (!pb) return; // sem playbook: nada a dizer

  const estado = await estadoIAConversaRepo(instancia.id, remoteJid);
  if (!estado || !estado.iaAtiva) return; // handoff já aconteceu

  const leitura = medirInteresse(textoLead, estado.iaInteresse);

  // Handoff: lead pediu uma pessoa → desliga a IA nesta conversa e para.
  if (leitura.pedeHumano) {
    await pausarIAConversaRepo(estado.id);
    await registrarInteresseRepo(estado.id, leitura.nota);
    return;
  }

  // Trava: estourou o limite de mensagens automáticas → só registra o interesse.
  if (estado.iaMensagens >= pb.maxMensagensAuto) {
    await registrarInteresseRepo(estado.id, leitura.nota);
    return;
  }

  const pbPrompt = {
    objetivo: pb.objetivo,
    contexto: pb.contexto,
    saudacaoAtiva: pb.saudacaoAtiva,
    desenvolvimentoAtiva: pb.desenvolvimentoAtiva,
    agendamentoAtiva: pb.agendamentoAtiva,
    fecho: pb.fecho,
    linkFecho: pb.linkFecho,
    servicos: pb.servicos.map((s) => ({ nome: s.nome, preco: s.preco, descricao: s.descricao })),
  };

  const estagio = estagioAtual(pbPrompt, estado.iaMensagens);
  if (estagio === "encerrado") {
    await registrarInteresseRepo(estado.id, leitura.nota);
    return; // roteiro acabou; não insiste
  }

  // Sem número não há para onde enviar (ex.: JID @lid). Guarda o interesse e sai.
  if (!estado.telefone) {
    await registrarInteresseRepo(estado.id, leitura.nota);
    return;
  }

  const historico = await listarMensagensRepo(instancia.orgId, estado.id);
  const turnos = historico.slice(-JANELA).map((m) => ({
    papel: m.direcao === "IN" ? ("user" as const) : ("assistant" as const),
    texto: m.texto,
  }));

  const system = montarSystemPrompt(pbPrompt, estagio, leitura.nota);
  const resposta = await gerarResposta(chave.provedor, {
    apiKey: chave.apiKey,
    modelo: chave.modelo,
    system,
    turnos,
  });

  const waId = await enviarTexto(cfg, instancia.evolutionInstance, estado.telefone, resposta);

  // Grava a saída no histórico. O `key.id` do WhatsApp deduplica o eco que volta
  // pelo webhook; sem ele, um id sintético mantém o `waMessageId` único.
  await registrarMensagemRepo(instancia.orgId, {
    conversaId: estado.id,
    waMessageId: waId ?? `auto-${crypto.randomUUID()}`,
    direcao: "OUT",
    autor: "ATENDENTE",
    texto: resposta,
  });

  // Avança o estágio conforme a mensagem que acabou de sair.
  const proximo = estagioAtual(pbPrompt, estado.iaMensagens + 1);
  await avancarIAConversaRepo(estado.id, { iaEstagio: proximo, iaInteresse: leitura.nota });
}
