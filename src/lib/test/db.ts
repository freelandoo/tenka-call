import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@prisma/client";

/** A ordem respeita as chaves estrangeiras: filhas antes das pais. */
export async function limparBanco(): Promise<void> {
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
