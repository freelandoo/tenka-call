import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import {
  estadoIAConversaRepo,
  garantirConversaRepo,
  registrarMensagemRepo,
} from "@/lib/repositories/conversas";
import { atualizarIAConfigRepo, salvarConexaoIARepo } from "@/lib/repositories/iaConfig";
import { salvarPlaybookRepo } from "@/lib/repositories/playbook";
import { responderAuto } from "@/lib/whatsapp/autoresposta";
import type { EventoWebhook } from "@/lib/whatsapp/ingest";

const JID = "5511987654321@s.whatsapp.net";

function eventoLead(instance: string, texto: string, id = "IN-1"): EventoWebhook {
  return {
    event: "messages.upsert",
    instance,
    data: { key: { id, remoteJid: JID, fromMe: false }, pushName: "Maria", message: { conversation: texto } },
  };
}

/** fetch mockado: roteia por URL para o provedor de IA e para a Evolution. */
function mockRede(respostaIA = "Olá! Somos da Tenka. Você teria interesse?") {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/message/sendText")) {
      return { status: 200, json: async () => ({ key: { id: "wamid-out-1" } }) } as Response;
    }
    if (u.includes("api.anthropic.com/v1/messages")) {
      return {
        status: 200,
        json: async () => ({ content: [{ type: "text", text: respostaIA }] }),
      } as Response;
    }
    return { status: 404, json: async () => ({}) } as Response;
  });
}

async function cenarioIA(maxMensagens = 2) {
  const org = await criarOrgTeste("tenka");
  const inst = await criarInstanciaRepo(org.id, org.slug, "Comercial");
  await salvarConexaoIARepo(org.id, inst.id, "claude", "sk-ant-xxx");
  await atualizarIAConfigRepo(org.id, inst.id, { modelo: "claude-opus-4-8" });
  await atualizarIAConfigRepo(org.id, inst.id, { ativo: true });
  await salvarPlaybookRepo(org.id, inst.id, {
    objetivo: "vender site",
    servicos: [{ nome: "Site", preco: "a partir de R$299", descricao: null }],
    maxMensagensAuto: maxMensagens,
  });
  const conversa = await garantirConversaRepo({
    orgId: org.id,
    instanciaId: inst.id,
    remoteJid: JID,
    pushName: "Maria",
  });
  return { org, inst, conversa };
}

describe("atendente automático (responderAuto)", () => {
  beforeEach(async () => {
    await limparBanco();
    process.env.EVOLUTION_URL = "http://evo.local";
    process.env.EVOLUTION_API_KEY = "k";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.EVOLUTION_URL;
    delete process.env.EVOLUTION_API_KEY;
  });

  it("responde o lead, grava a saída e avança o estágio", async () => {
    const { org, inst, conversa } = await cenarioIA();
    await registrarMensagemRepo(org.id, {
      conversaId: conversa.id,
      waMessageId: "IN-1",
      direcao: "IN",
      autor: "LEAD",
      texto: "oi",
    });
    global.fetch = mockRede();

    await responderAuto(eventoLead(inst.evolutionInstance, "oi"));

    const saida = await prisma.mensagem.findFirst({
      where: { conversaId: conversa.id, direcao: "OUT" },
    });
    expect(saida?.autor).toBe("ATENDENTE");
    expect(saida?.waMessageId).toBe("wamid-out-1");

    const estado = await estadoIAConversaRepo(inst.id, JID);
    expect(estado?.iaMensagens).toBe(1);
    expect(estado?.iaEstagio).toBe("desenvolvimento");
  });

  it("handoff: pedido de humano desliga a IA e não envia nem chama a IA", async () => {
    const { inst } = await cenarioIA();
    const fetchSpy = mockRede();
    global.fetch = fetchSpy;

    await responderAuto(eventoLead(inst.evolutionInstance, "quero falar com um atendente"));

    expect((await estadoIAConversaRepo(inst.id, JID))?.iaAtiva).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("trava: no limite de mensagens automáticas, não responde", async () => {
    const { inst, conversa } = await cenarioIA(2);
    await prisma.conversa.update({ where: { id: conversa.id }, data: { iaMensagens: 2 } });
    const fetchSpy = mockRede();
    global.fetch = fetchSpy;

    await responderAuto(eventoLead(inst.evolutionInstance, "quanto custa?"));

    expect(await prisma.mensagem.count({ where: { conversaId: conversa.id, direcao: "OUT" } })).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("não responde às próprias mensagens (sem loop)", async () => {
    const { inst } = await cenarioIA();
    const fetchSpy = mockRede();
    global.fetch = fetchSpy;

    const eco: EventoWebhook = {
      event: "messages.upsert",
      instance: inst.evolutionInstance,
      data: { key: { id: "OUT-eco", remoteJid: JID, fromMe: true }, message: { conversation: "oi de novo" } },
    };
    await responderAuto(eco);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("IA desligada (sem config nem playbook) não responde", async () => {
    const org = await criarOrgTeste("tenka");
    const inst = await criarInstanciaRepo(org.id, org.slug, "Comercial");
    await garantirConversaRepo({ orgId: org.id, instanciaId: inst.id, remoteJid: JID, pushName: "Maria" });
    const fetchSpy = mockRede();
    global.fetch = fetchSpy;

    await responderAuto(eventoLead(inst.evolutionInstance, "oi"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
