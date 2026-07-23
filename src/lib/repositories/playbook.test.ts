import { describe, it, expect, beforeEach } from "vitest";
import { limparBanco, criarOrgTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import { obterPlaybookRepo, salvarPlaybookRepo } from "@/lib/repositories/playbook";

async function cenario() {
  const org = await criarOrgTeste("tenka");
  const instancia = await criarInstanciaRepo(org.id, org.slug, "Comercial");
  return { org, instancia };
}

describe("repositório de playbook", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("instância sem playbook devolve o vazio (não nulo)", async () => {
    const { org, instancia } = await cenario();
    const pb = await obterPlaybookRepo(org.id, instancia.id);
    expect(pb).toMatchObject({ objetivo: "", fecho: "reuniao", maxMensagensAuto: 8, servicos: [] });
  });

  it("salva e relê objetivo, serviços e fecho", async () => {
    const { org, instancia } = await cenario();
    await salvarPlaybookRepo(org.id, instancia.id, {
      objetivo: "Vender sites",
      fecho: "link",
      linkFecho: "https://tenka.com/cadastro",
      maxMensagensAuto: 5,
      servicos: [
        { nome: "Site", preco: "a partir de R$299", descricao: "one page" },
        { nome: "", preco: "ignorado", descricao: null },
      ],
    });

    const pb = await obterPlaybookRepo(org.id, instancia.id);
    expect(pb).toMatchObject({
      objetivo: "Vender sites",
      fecho: "link",
      linkFecho: "https://tenka.com/cadastro",
      maxMensagensAuto: 5,
    });
    // Serviço sem nome é descartado.
    expect(pb?.servicos).toEqual([
      { nome: "Site", preco: "a partir de R$299", descricao: "one page" },
    ]);
  });

  it("reescrever os serviços substitui a lista inteira", async () => {
    const { org, instancia } = await cenario();
    await salvarPlaybookRepo(org.id, instancia.id, {
      servicos: [{ nome: "Antigo", preco: "R$1", descricao: null }],
    });
    await salvarPlaybookRepo(org.id, instancia.id, {
      servicos: [{ nome: "Novo", preco: "R$2", descricao: null }],
    });
    const pb = await obterPlaybookRepo(org.id, instancia.id);
    expect(pb?.servicos.map((s) => s.nome)).toEqual(["Novo"]);
  });

  it("limita maxMensagensAuto a um intervalo são", async () => {
    const { org, instancia } = await cenario();
    await salvarPlaybookRepo(org.id, instancia.id, { maxMensagensAuto: 999 });
    expect((await obterPlaybookRepo(org.id, instancia.id))?.maxMensagensAuto).toBe(50);
  });

  it("instância de outra empresa não expõe nem aceita playbook", async () => {
    const { instancia } = await cenario();
    const outra = await criarOrgTeste("empresa-b");
    expect(await obterPlaybookRepo(outra.id, instancia.id)).toBeNull();
    expect(await salvarPlaybookRepo(outra.id, instancia.id, { objetivo: "x" })).toBe(false);
  });
});
