import { describe, it, expect, beforeEach } from "vitest";
import { limparBanco, criarOrgTeste } from "@/lib/test/db";
import { criarInstanciaRepo } from "@/lib/repositories/instancias";
import {
  obterIAConfigRepo,
  obterChaveIARepo,
  salvarConexaoIARepo,
  atualizarIAConfigRepo,
} from "@/lib/repositories/iaConfig";

async function cenario(slug = "tenka", nomeInstancia = "Comercial") {
  const org = await criarOrgTeste(slug);
  const instancia = await criarInstanciaRepo(org.id, org.slug, nomeInstancia);
  return { org, instancia };
}

describe("repositório de config de IA", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("instância sem config devolve estado vazio, não nulo", async () => {
    const { org, instancia } = await cenario();
    const config = await obterIAConfigRepo(org.id, instancia.id);
    expect(config).toMatchObject({ ativo: false, provedor: null, modelo: null, temChave: false });
  });

  it("conectar guarda a chave mas ela nunca volta na leitura pública", async () => {
    const { org, instancia } = await cenario();

    const ok = await salvarConexaoIARepo(org.id, instancia.id, "claude", "sk-ant-secreta");
    expect(ok).toBe(true);

    const config = await obterIAConfigRepo(org.id, instancia.id);
    expect(config).toMatchObject({ provedor: "claude", temChave: true });
    expect(config as unknown as Record<string, unknown>).not.toHaveProperty("apiKey");
  });

  it("trocar de provedor zera o modelo escolhido", async () => {
    const { org, instancia } = await cenario();
    await salvarConexaoIARepo(org.id, instancia.id, "claude", "sk-ant");
    await atualizarIAConfigRepo(org.id, instancia.id, { modelo: "claude-opus-4-8" });

    await salvarConexaoIARepo(org.id, instancia.id, "openai", "sk-oai");

    const config = await obterIAConfigRepo(org.id, instancia.id);
    expect(config).toMatchObject({ provedor: "openai", modelo: null });
  });

  it("a chave crua só sai quando a IA está ativa e completa", async () => {
    const { org, instancia } = await cenario();
    await salvarConexaoIARepo(org.id, instancia.id, "claude", "sk-ant");

    // Sem modelo e desligada: nada de chave.
    expect(await obterChaveIARepo(org.id, instancia.id)).toBeNull();

    await atualizarIAConfigRepo(org.id, instancia.id, { modelo: "claude-opus-4-8" });
    await atualizarIAConfigRepo(org.id, instancia.id, { ativo: true });

    expect(await obterChaveIARepo(org.id, instancia.id)).toEqual({
      provedor: "claude",
      apiKey: "sk-ant",
      modelo: "claude-opus-4-8",
    });
  });

  it("instância de outra empresa não expõe nem aceita config", async () => {
    const { instancia } = await cenario();
    const outra = await criarOrgTeste("empresa-b");

    expect(await obterIAConfigRepo(outra.id, instancia.id)).toBeNull();
    expect(await salvarConexaoIARepo(outra.id, instancia.id, "claude", "sk")).toBe(false);
  });
});
