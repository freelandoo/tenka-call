import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste, criarUsuarioTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import { chaveTelefone } from "@/lib/whatsapp/telefone";
import {
  garantirConversaRepo,
  registrarMensagemRepo,
  listarConversasRepo,
  obterConversaRepo,
  listarMensagensRepo,
  listarAtendimentosRepo,
  classificarConversaRepo,
  marcarConversaLidaRepo,
} from "@/lib/repositories/conversas";

const JID = "5511987654321@s.whatsapp.net";

/** Lead cadastrado à mão, como a equipe faria — `ultimos8` é escrito na escrita. */
function criarLead(orgId: string, nome: string, telefone: string) {
  return prisma.lead.create({
    data: { orgId, nome, telefone, ultimos8: chaveTelefone(telefone), origem: "manual" },
  });
}

async function cenario(slug = "tenka", nomeInstancia = "Comercial") {
  const org = await criarOrgTeste(slug);
  const instancia = await criarInstanciaRepo(org.id, org.slug, nomeInstancia);
  return { org, instancia };
}

describe("repositório de conversas", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("primeira mensagem cria conversa, lead e mensagem, e conta não lidas", async () => {
    const { org, instancia } = await cenario();

    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    const gravou = await registrarMensagemRepo(org.id, {
      conversaId: conversa.id,
      waMessageId: "3EB0ABC",
      direcao: "IN",
      autor: "LEAD",
      texto: "Oi, quero saber o valor",
    });

    expect(gravou).toBe(true);

    const lead = await prisma.lead.findFirstOrThrow({ where: { orgId: org.id } });
    expect(lead.nome).toBe("Maria");
    expect(lead.telefone).toBe("5511987654321");
    expect(lead.ultimos8).toBe("87654321");
    expect(lead.origem).toBe("whatsapp");
    expect(lead.estagio).toBe("novo");

    const resumo = await obterConversaRepo(org.id, conversa.id);
    expect(resumo).toMatchObject({ nome: "Maria", naoLidas: 1, preview: "Oi, quero saber o valor" });
    expect(resumo?.leadId).toBe(lead.id);
  });

  it("reentrega do mesmo waMessageId não duplica a bolha", async () => {
    const { org, instancia } = await cenario();
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    const mensagem = {
      conversaId: conversa.id,
      waMessageId: "3EB0ABC",
      direcao: "IN" as const,
      autor: "LEAD" as const,
      texto: "Oi",
    };

    expect(await registrarMensagemRepo(org.id, mensagem)).toBe(true);
    expect(await registrarMensagemRepo(org.id, mensagem)).toBe(false);

    expect(await listarMensagensRepo(org.id, conversa.id)).toHaveLength(1);
    expect((await obterConversaRepo(org.id, conversa.id))?.naoLidas).toBe(1);
  });

  it("número já cadastrado vincula no lead existente em vez de duplicar", async () => {
    const { org, instancia } = await cenario();
    // Cadastrado formatado e sem DDI — o casamento é pelos últimos 8 dígitos.
    const existente = await criarLead(org.id, "Maria Silva", "(11) 98765-4321");

    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    expect(conversa.leadId).toBe(existente.id);
    expect(await prisma.lead.count({ where: { orgId: org.id } })).toBe(1);
  });

  it("cadastro sem o 9º dígito também casa", async () => {
    const { org, instancia } = await cenario();
    const existente = await criarLead(org.id, "Maria Silva", "1187654321");

    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    expect(conversa.leadId).toBe(existente.id);
  });

  it("lead de outra empresa com o mesmo número não é vinculado", async () => {
    const outra = await criarOrgTeste("empresa-b");
    const daOutra = await criarLead(outra.id, "Maria da B", "5511987654321");
    const { org, instancia } = await cenario();

    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    expect(conversa.leadId).not.toBe(daOutra.id);
    expect(await prisma.lead.count({ where: { orgId: org.id } })).toBe(1);
    expect(await prisma.lead.count({ where: { orgId: outra.id } })).toBe(1);
  });

  it("mensagem enviada pelo aparelho entra como saída sem autor e zera não lidas", async () => {
    const { org, instancia } = await cenario();
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    await registrarMensagemRepo(org.id, {
      conversaId: conversa.id,
      waMessageId: "IN-1",
      direcao: "IN",
      autor: "LEAD",
      texto: "Oi",
    });

    await registrarMensagemRepo(org.id, {
      conversaId: conversa.id,
      waMessageId: "OUT-1",
      direcao: "OUT",
      autor: "ATENDENTE",
      texto: "Bom dia!",
    });

    const mensagens = await listarMensagensRepo(org.id, conversa.id);
    expect(mensagens.at(-1)).toMatchObject({ direcao: "OUT", autor: "ATENDENTE", autorNome: null });
    expect((await obterConversaRepo(org.id, conversa.id))?.naoLidas).toBe(0);
  });

  it("@lid entra sem telefone, e o lead nasce sem número para a equipe completar", async () => {
    const { org, instancia } = await cenario();

    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: "199384756@lid",
      pushName: "",
    });

    expect(conversa.telefone).toBe("");
    const lead = await prisma.lead.findFirstOrThrow({ where: { orgId: org.id } });
    expect(lead.telefone).toBe("");
    expect(lead.ultimos8).toBe("");
  });

  it("duas instâncias da mesma empresa mantêm conversas separadas para o mesmo número", async () => {
    const { org, instancia } = await cenario();
    const suporte = await criarInstanciaRepo(org.id, org.slug, "Suporte");

    const naComercial = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    const noSuporte = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: suporte.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    expect(naComercial.id).not.toBe(noSuporte.id);
    // Mesmo número, mesma pessoa: um lead só.
    expect(naComercial.leadId).toBe(noSuporte.leadId);
    expect(await prisma.lead.count({ where: { orgId: org.id } })).toBe(1);

    const soDoSuporte = await listarConversasRepo(org.id, { instanciaId: suporte.id });
    expect(soDoSuporte.map((c) => c.id)).toEqual([noSuporte.id]);
  });

  it("classificar grava o registro de atendimento e move o estágio do lead", async () => {
    const { org, instancia } = await cenario();
    const user = await criarUsuarioTeste(org.id, "ana");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    await classificarConversaRepo(org.id, {
      conversaId: conversa.id,
      userId: user.id,
      interesse: "com_interesse",
      observacao: "Vai passar amanhã",
    });

    const lead = await prisma.lead.findFirstOrThrow({ where: { orgId: org.id } });
    expect(lead.estagio).toBe("interesse");

    const registros = await listarAtendimentosRepo(org.id, conversa.id);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      usuario: "ana",
      interesse: "com_interesse",
      observacao: "Vai passar amanhã",
    });

    const resumo = await obterConversaRepo(org.id, conversa.id);
    expect(resumo?.interesse).toBe("com_interesse");
    expect(resumo?.atendente).toBe("ana");
  });

  it("perdido guarda o motivo no lead", async () => {
    const { org, instancia } = await cenario();
    const user = await criarUsuarioTeste(org.id, "ana");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    await classificarConversaRepo(org.id, {
      conversaId: conversa.id,
      userId: user.id,
      interesse: "perdido",
      motivoPerdido: "Achou caro",
    });

    const lead = await prisma.lead.findFirstOrThrow({ where: { orgId: org.id } });
    expect(lead.estagio).toBe("perdido");
    expect(lead.motivoPerdido).toBe("Achou caro");
  });

  it("classificar conversa de outra empresa não faz nada", async () => {
    const { org, instancia } = await cenario();
    const outra = await criarOrgTeste("empresa-b");
    const intruso = await criarUsuarioTeste(outra.id, "bruno");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    const r = await classificarConversaRepo(outra.id, {
      conversaId: conversa.id,
      userId: intruso.id,
      interesse: "convertido",
    });

    expect(r).toBeNull();
    expect(await prisma.atendimentoRegistro.count()).toBe(0);
    expect((await prisma.lead.findFirstOrThrow({ where: { orgId: org.id } })).estagio).toBe("novo");
  });

  it("a lista traz o último registro de atendimento e só conversas da própria empresa", async () => {
    const { org, instancia } = await cenario();
    const user = await criarUsuarioTeste(org.id, "ana");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    const outra = await cenario("empresa-b", "Suporte");
    await garantirConversaRepo({
      orgId: outra.org.id,
      instanciaId: outra.instancia.id,
      remoteJid: JID,
      pushName: "Maria da B",
    });

    await classificarConversaRepo(org.id, {
      conversaId: conversa.id,
      userId: user.id,
      interesse: "sem_interesse",
      observacao: "Primeiro contato",
    });
    await classificarConversaRepo(org.id, {
      conversaId: conversa.id,
      userId: user.id,
      interesse: "com_interesse",
      observacao: "Voltou atrás, quer agendar",
    });

    const lista = await listarConversasRepo(org.id);

    expect(lista).toHaveLength(1);
    expect(lista[0].instanciaNome).toBe("Comercial");
    expect(lista[0].ultimoRegistro).toMatchObject({
      usuario: "ana",
      interesse: "com_interesse",
      observacao: "Voltou atrás, quer agendar",
    });
    // Append-only: o registro anterior continua no histórico.
    expect(await listarAtendimentosRepo(org.id, conversa.id)).toHaveLength(2);
  });

  it("conversa de outra empresa não é lida nem marcada como lida", async () => {
    const { org, instancia } = await cenario();
    const outra = await criarOrgTeste("empresa-b");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });
    await registrarMensagemRepo(org.id, {
      conversaId: conversa.id,
      waMessageId: "IN-1",
      direcao: "IN",
      autor: "LEAD",
      texto: "Oi",
    });

    expect(await obterConversaRepo(outra.id, conversa.id)).toBeNull();
    expect(await listarMensagensRepo(outra.id, conversa.id)).toEqual([]);
    expect(await listarAtendimentosRepo(outra.id, conversa.id)).toEqual([]);
    expect(await marcarConversaLidaRepo(outra.id, conversa.id)).toBe(false);
    expect((await obterConversaRepo(org.id, conversa.id))?.naoLidas).toBe(1);
  });

  it("mensagem em conversa de outra empresa não é gravada", async () => {
    const { org, instancia } = await cenario();
    const outra = await criarOrgTeste("empresa-b");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    const gravou = await registrarMensagemRepo(outra.id, {
      conversaId: conversa.id,
      waMessageId: "X-1",
      direcao: "OUT",
      autor: "ATENDENTE",
      texto: "invasão",
    });

    expect(gravou).toBe(false);
    expect(await prisma.mensagem.count()).toBe(0);
  });

  it("pushName novo atualiza a conversa sem criar outra", async () => {
    const { org, instancia } = await cenario();
    const primeira = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    const segunda = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria Silva",
    });

    expect(segunda.id).toBe(primeira.id);
    expect(segunda.pushName).toBe("Maria Silva");
    expect(await prisma.conversa.count()).toBe(1);
  });
});
