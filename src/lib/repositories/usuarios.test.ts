import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste, criarUsuarioTeste } from "@/lib/test/db";
import {
  listarUsuariosRepo,
  criarUsuarioRepo,
  usuarioDaOrgRepo,
  definirAtivoRepo,
  definirSenhaRepo,
} from "@/lib/repositories/usuarios";

describe("repositório de usuários", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("lista só os usuários da própria empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarUsuarioTeste(a.id, "ana");
    await criarUsuarioTeste(b.id, "bruno");

    const lista = await listarUsuariosRepo(a.id);

    expect(lista.map((u) => u.login)).toEqual(["ana"]);
  });

  it("cria usuário na empresa informada, com senha provisória", async () => {
    const a = await criarOrgTeste("empresa-a");

    const criado = await criarUsuarioRepo(a.id, {
      login: "Carla",
      nome: "Carla Souza",
      role: "ADMIN",
      senha: "provisoria-123",
    });

    expect(criado.orgId).toBe(a.id);
    expect(criado.login).toBe("carla"); // normalizado
    expect(criado.senhaProvisoria).toBe(true);
    expect(criado.passwordHash).not.toContain("provisoria-123");
  });

  it("recusa login já em uso", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarUsuarioRepo(a.id, { login: "duplo", nome: "Duplo", role: "ATENDENTE", senha: "x1" });

    await expect(
      criarUsuarioRepo(b.id, { login: "duplo", nome: "Outro", role: "ATENDENTE", senha: "x2" }),
    ).rejects.toThrow("login já em uso");
  });

  it("não devolve usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");

    expect(await usuarioDaOrgRepo(b.id, daA.id)).toBeNull();
    expect(await usuarioDaOrgRepo(a.id, daA.id)).not.toBeNull();
  });

  it("não desativa usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");

    const mexeu = await definirAtivoRepo(b.id, daA.id, false);

    expect(mexeu).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).ativo).toBe(true);
  });

  it("não troca a senha de usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");
    const antes = (await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash;

    const mexeu = await definirSenhaRepo(b.id, daA.id, "invadida", true);

    expect(mexeu).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash).toBe(antes);
  });

  it("troca a senha dentro da própria empresa e marca provisória", async () => {
    const a = await criarOrgTeste("empresa-a");
    const daA = await criarUsuarioTeste(a.id, "ana");
    const antes = (await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash;

    const mexeu = await definirSenhaRepo(a.id, daA.id, "nova-senha-456", true);

    const depois = await prisma.user.findUniqueOrThrow({ where: { id: daA.id } });
    expect(mexeu).toBe(true);
    expect(depois.passwordHash).not.toBe(antes);
    expect(depois.senhaProvisoria).toBe(true);
  });
});
