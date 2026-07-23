import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import { listarConversasRepo, listarMensagensRepo } from "@/lib/repositories/conversas";
import { processarEventoWhatsapp } from "@/lib/whatsapp/ingest";

const JID = "5511999000111@s.whatsapp.net";
const JID_GRUPO = "120363000000000000@g.us";

function evento(instancia: string, over: { id: string; remoteJid?: string; texto?: string; fromMe?: boolean }) {
  return {
    event: "messages.upsert",
    instance: instancia,
    data: {
      key: { id: over.id, remoteJid: over.remoteJid ?? JID, fromMe: over.fromMe ?? false },
      pushName: "Cliente Teste",
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { conversation: over.texto ?? "Oi, quanto custa?" },
    },
  };
}

describe("ingestão do webhook", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("a empresa vem da instância, nunca do payload", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");
    await criarInstanciaRepo(b.id, b.slug, "Comercial");

    const r = await processarEventoWhatsapp(evento("empresa-b-comercial", { id: "MSG-1" }));

    expect(r).toMatchObject({ tipo: "mensagens", gravadas: 1, duplicadas: 0 });
    expect(await listarConversasRepo(a.id)).toEqual([]);
    const daB = await listarConversasRepo(b.id);
    expect(daB).toHaveLength(1);
    expect(daB[0].preview).toBe("Oi, quanto custa?");
    expect(await prisma.lead.count({ where: { orgId: a.id } })).toBe(0);
    expect(await prisma.lead.count({ where: { orgId: b.id } })).toBe(1);
  });

  it("instância desconhecida é ignorada sem quebrar", async () => {
    const r = await processarEventoWhatsapp(evento("ninguem-conhece", { id: "MSG-2" }));

    expect(r).toMatchObject({ tipo: "ignorado" });
    expect(await prisma.conversa.count()).toBe(0);
  });

  it("grupo é ignorado", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    const r = await processarEventoWhatsapp(
      evento("tenka-comercial", { id: "MSG-3", remoteJid: JID_GRUPO }),
    );

    expect(r).toMatchObject({ gravadas: 0, duplicadas: 0 });
    expect(await prisma.conversa.count()).toBe(0);
  });

  it("reentrega do mesmo waMessageId não duplica", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    await processarEventoWhatsapp(evento("tenka-comercial", { id: "MSG-4" }));
    const r = await processarEventoWhatsapp(evento("tenka-comercial", { id: "MSG-4" }));

    expect(r).toMatchObject({ gravadas: 0, duplicadas: 1 });
    const conversa = await prisma.conversa.findFirstOrThrow();
    expect(await listarMensagensRepo(a.id, conversa.id)).toHaveLength(1);
    expect(conversa.naoLidas).toBe(1);
  });

  it("mensagem do próprio aparelho entra como saída e zera não lidas", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    await processarEventoWhatsapp(evento("tenka-comercial", { id: "MSG-5" }));
    await processarEventoWhatsapp(
      evento("tenka-comercial", { id: "MSG-6", fromMe: true, texto: "Bom dia! Custa 99." }),
    );

    const conversa = await prisma.conversa.findFirstOrThrow();
    const mensagens = await listarMensagensRepo(a.id, conversa.id);
    expect(mensagens.at(-1)).toMatchObject({ direcao: "OUT", autor: "ATENDENTE", autorNome: null });
    expect(conversa.naoLidas).toBe(0);
  });

  it("'connecting' não derruba uma instância conectada; 'close' derruba", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");
    const base = { event: "connection.update", instance: "tenka-comercial" };
    const status = async () =>
      prisma.instancia.findUniqueOrThrow({ where: { evolutionInstance: "tenka-comercial" } });

    await processarEventoWhatsapp({ ...base, data: { state: "open", wuid: "5511999000111@s.whatsapp.net" } });
    expect(await status()).toMatchObject({ status: "CONNECTED", numeroConectado: "5511999000111" });

    // Handshake/reconexão: estado de passagem, não queda.
    await processarEventoWhatsapp({ ...base, data: { state: "connecting" } });
    expect((await status()).status).toBe("CONNECTED");

    await processarEventoWhatsapp({ ...base, data: { state: "close", statusReason: 428 } });
    const caiu = await status();
    expect(caiu.status).toBe("DISCONNECTED");
    expect(caiu.ultimoErro).toContain("428");
  });

  it("connection.update de uma instância não afeta as outras da empresa", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");
    await criarInstanciaRepo(a.id, a.slug, "Suporte");

    await processarEventoWhatsapp({
      event: "connection.update",
      instance: "tenka-comercial",
      data: { state: "open" },
    });

    const suporte = await prisma.instancia.findUniqueOrThrow({
      where: { evolutionInstance: "tenka-suporte" },
    });
    expect(suporte.status).toBe("DISCONNECTED");
  });

  it("evento de outro tipo é ignorado", async () => {
    const r = await processarEventoWhatsapp({ event: "qrcode.updated", instance: "tenka-comercial" });
    expect(r).toMatchObject({ tipo: "ignorado" });
  });
});
