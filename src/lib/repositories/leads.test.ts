import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste, criarUsuarioTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import { chaveTelefone } from "@/lib/whatsapp/telefone";
import { garantirConversaRepo, classificarConversaRepo } from "@/lib/repositories/conversas";
import { listarLeadsRepo } from "@/lib/repositories/leads";

const JID = "5511987654321@s.whatsapp.net";

function criarLead(orgId: string, nome: string, telefone: string, origem = "manual") {
  return prisma.lead.create({
    data: { orgId, nome, telefone, ultimos8: chaveTelefone(telefone), origem },
  });
}

describe("repositório de leads", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("lista os leads da empresa, do mais novo para o mais antigo", async () => {
    const org = await criarOrgTeste("tenka");
    await criarLead(org.id, "Antigo", "5511900000001");
    await criarLead(org.id, "Recente", "5511900000002");

    const leads = await listarLeadsRepo(org.id);

    expect(leads.map((l) => l.nome)).toEqual(["Recente", "Antigo"]);
    expect(leads[0]).toMatchObject({ estagio: "novo", origem: "manual", conversaId: null });
  });

  it("não vaza lead de outra empresa", async () => {
    const org = await criarOrgTeste("tenka");
    const outra = await criarOrgTeste("empresa-b");
    await criarLead(org.id, "Meu", "5511900000001");
    await criarLead(outra.id, "Alheio", "5511900000002");

    const leads = await listarLeadsRepo(org.id);

    expect(leads).toHaveLength(1);
    expect(leads[0].nome).toBe("Meu");
  });

  it("traz a conversa mais recente do lead para o botão Responder", async () => {
    const org = await criarOrgTeste("tenka");
    const instancia = await criarInstanciaRepo(org.id, org.slug, "Comercial");
    const conversa = await garantirConversaRepo({
      orgId: org.id,
      instanciaId: instancia.id,
      remoteJid: JID,
      pushName: "Maria",
    });

    const leads = await listarLeadsRepo(org.id);

    expect(leads).toHaveLength(1);
    expect(leads[0].conversaId).toBe(conversa.id);
    expect(leads[0].origem).toBe("whatsapp");
    expect(leads[0].telefoneCru).toBe("5511987654321");
  });

  it("reflete o estágio depois da classificação do inbox", async () => {
    const org = await criarOrgTeste("tenka");
    const user = await criarUsuarioTeste(org.id, "ana");
    const instancia = await criarInstanciaRepo(org.id, org.slug, "Comercial");
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

    const leads = await listarLeadsRepo(org.id);
    expect(leads[0]).toMatchObject({ estagio: "perdido", motivoPerdido: "Achou caro" });
  });
});
