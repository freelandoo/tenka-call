import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const SELECAO = {
  id: true,
  login: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  senhaProvisoria: true,
  criadoEm: true,
} as const;

export type UsuarioDaLista = Prisma.UserGetPayload<{ select: typeof SELECAO }>;

export function normalizarLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function listarUsuariosRepo(orgId: string): Promise<UsuarioDaLista[]> {
  return prisma.user.findMany({
    where: { orgId },
    select: SELECAO,
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
}

export interface NovoUsuario {
  login: string;
  nome: string;
  role: Role;
  senha: string;
  email?: string | null;
}

export async function criarUsuarioRepo(orgId: string, dados: NovoUsuario) {
  try {
    return await prisma.user.create({
      data: {
        orgId,
        login: normalizarLogin(dados.login),
        nome: dados.nome.trim(),
        email: dados.email?.trim() || null,
        role: dados.role,
        passwordHash: await hashPassword(dados.senha),
        senhaProvisoria: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("login já em uso");
    }
    throw e;
  }
}

/** Null quando o id não existe OU pertence a outra empresa — não confirma existência. */
export function usuarioDaOrgRepo(orgId: string, id: string): Promise<UsuarioDaLista | null> {
  return prisma.user.findFirst({ where: { id, orgId }, select: SELECAO });
}

/** Devolve false quando nada foi alterado (id inexistente ou de outra empresa). */
export async function definirAtivoRepo(orgId: string, id: string, ativo: boolean): Promise<boolean> {
  const r = await prisma.user.updateMany({ where: { id, orgId }, data: { ativo } });
  if (r.count > 0 && !ativo) {
    // Desativar encerra as sessões abertas: o acesso cai na hora.
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  return r.count > 0;
}

export async function definirSenhaRepo(
  orgId: string,
  id: string,
  senha: string,
  provisoria: boolean,
): Promise<boolean> {
  const r = await prisma.user.updateMany({
    where: { id, orgId },
    data: { passwordHash: await hashPassword(senha), senhaProvisoria: provisoria },
  });
  return r.count > 0;
}
