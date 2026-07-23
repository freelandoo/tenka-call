import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@prisma/client";

/**
 * Trava de segurança: `limparBanco` apaga TODAS as tabelas. Rodar contra o banco
 * de dev/produção limpa dados reais (já aconteceu). O banco de teste tem "test"
 * no nome (`tenka_test`, via `.env.test`); qualquer outro aborta a suíte inteira.
 */
function exigirBancoDeTeste(): void {
  const url = process.env.DATABASE_URL ?? "";
  const nomeBanco = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(nomeBanco)) {
    throw new Error(
      `limparBanco recusou: DATABASE_URL aponta para "${nomeBanco || "?"}", que não é um banco de teste. ` +
        `Os testes exigem um banco com "test" no nome (veja .env.test). Abortando para não apagar dados reais.`,
    );
  }
}

/** A ordem respeita as chaves estrangeiras: filhas antes das pais. */
export async function limparBanco(): Promise<void> {
  exigirBancoDeTeste();
  await prisma.atendimentoRegistro.deleteMany();
  await prisma.mensagem.deleteMany();
  await prisma.conversa.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.instancia.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
}

export function criarOrgTeste(slug: string) {
  return prisma.org.create({ data: { slug, nome: slug.toUpperCase() } });
}

export async function criarUsuarioTeste(orgId: string, login: string, role: Role = "ATENDENTE") {
  return prisma.user.create({
    data: {
      orgId,
      login,
      nome: login,
      role,
      passwordHash: await hashPassword("senha-de-teste"),
    },
  });
}
