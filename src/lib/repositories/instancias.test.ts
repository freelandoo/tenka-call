import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste } from "@/lib/test/db";
import {
  listarInstanciasRepo,
  criarInstanciaRepo,
  instanciaDaOrgRepo,
  removerInstanciaRepo,
  porNomeTecnicoRepo,
  atualizarStatusPorNomeTecnicoRepo,
} from "@/lib/repositories/instancias";

describe("repositório de instâncias", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("deriva o nome técnico da empresa + nome amigável", async () => {
    const a = await criarOrgTeste("tenka");

    const criada = await criarInstanciaRepo(a.id, a.slug, "Suporte Técnico");

    expect(criada.evolutionInstance).toBe("tenka-suporte-tecnico");
    expect(criada.nome).toBe("Suporte Técnico");
    expect(criada.status).toBe("DISCONNECTED");
  });

  it("lista só as instâncias da própria empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");
    await criarInstanciaRepo(b.id, b.slug, "Suporte");

    const lista = await listarInstanciasRepo(a.id);

    expect(lista.map((i) => i.nome)).toEqual(["Comercial"]);
  });

  it("instância de outra empresa não é encontrada", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarInstanciaRepo(a.id, a.slug, "Comercial");

    expect(await instanciaDaOrgRepo(a.id, daA.id)).not.toBeNull();
    expect(await instanciaDaOrgRepo(b.id, daA.id)).toBeNull();
  });

  it("remover instância de outra empresa não apaga nada", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarInstanciaRepo(a.id, a.slug, "Comercial");

    expect(await removerInstanciaRepo(b.id, daA.id)).toBeNull();
    expect(await prisma.instancia.count({ where: { id: daA.id } })).toBe(1);

    // A dona remove e recebe o nome técnico de volta, para desfazer na Evolution.
    expect(await removerInstanciaRepo(a.id, daA.id)).toBe("empresa-a-comercial");
    expect(await prisma.instancia.count({ where: { id: daA.id } })).toBe(0);
  });

  it("duas empresas podem ter uma instância com o mesmo nome amigável", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");

    const daA = await criarInstanciaRepo(a.id, a.slug, "Comercial");
    const daB = await criarInstanciaRepo(b.id, b.slug, "Comercial");

    expect(daA.evolutionInstance).not.toBe(daB.evolutionInstance);
  });

  it("a mesma empresa não repete o nome amigável", async () => {
    const a = await criarOrgTeste("empresa-a");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    await expect(criarInstanciaRepo(a.id, a.slug, "Comercial")).rejects.toThrow(/já existe/i);
  });

  it("nome que vira slug vazio é recusado", async () => {
    const a = await criarOrgTeste("empresa-a");

    await expect(criarInstanciaRepo(a.id, a.slug, "###")).rejects.toThrow();
  });

  it("o nome técnico devolve a empresa dona — é como o webhook a descobre", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    const achada = await porNomeTecnicoRepo("tenka-comercial");

    expect(achada?.orgId).toBe(a.id);
    expect(await porNomeTecnicoRepo("empresa-inexistente")).toBeNull();
  });

  it("atualizar status de uma instância não mexe no status das outras", async () => {
    const a = await criarOrgTeste("tenka");
    const comercial = await criarInstanciaRepo(a.id, a.slug, "Comercial");
    const suporte = await criarInstanciaRepo(a.id, a.slug, "Suporte");

    await atualizarStatusPorNomeTecnicoRepo("tenka-comercial", "CONNECTED", "5511987654321");

    const depoisComercial = await prisma.instancia.findUnique({ where: { id: comercial.id } });
    const depoisSuporte = await prisma.instancia.findUnique({ where: { id: suporte.id } });
    expect(depoisComercial?.status).toBe("CONNECTED");
    expect(depoisComercial?.numeroConectado).toBe("5511987654321");
    expect(depoisComercial?.ultimoEstadoEm).not.toBeNull();
    expect(depoisSuporte?.status).toBe("DISCONNECTED");
  });

  it("queda guarda o motivo, e reconexão limpa o erro anterior", async () => {
    const a = await criarOrgTeste("tenka");
    await criarInstanciaRepo(a.id, a.slug, "Comercial");

    await atualizarStatusPorNomeTecnicoRepo("tenka-comercial", "DISCONNECTED", null, "conexão fechada");
    expect((await porNomeTecnicoRepo("tenka-comercial"))?.ultimoErro).toBe("conexão fechada");

    await atualizarStatusPorNomeTecnicoRepo("tenka-comercial", "CONNECTED", "5511987654321");
    expect((await porNomeTecnicoRepo("tenka-comercial"))?.ultimoErro).toBeNull();
  });

  it("status de instância desconhecida não quebra", async () => {
    await expect(
      atualizarStatusPorNomeTecnicoRepo("nao-existe", "CONNECTED"),
    ).resolves.toBeNull();
  });
});
