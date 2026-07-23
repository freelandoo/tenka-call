import { Prisma, type WhatsappStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nomeTecnico } from "@/lib/whatsapp/instancia";

export function listarInstanciasRepo(orgId: string) {
  return prisma.instancia.findMany({ where: { orgId }, orderBy: { criadoEm: "asc" } });
}

/**
 * O nome técnico é derivado aqui, nunca recebido de fora: é ele que amarra a
 * instância à empresa na Evolution compartilhada.
 */
export async function criarInstanciaRepo(orgId: string, orgSlug: string, nome: string) {
  const amigavel = nome.trim();
  const evolutionInstance = nomeTecnico(orgSlug, amigavel);
  try {
    return await prisma.instancia.create({
      data: { orgId, evolutionInstance, nome: amigavel },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("já existe uma instância com esse nome");
    }
    throw e;
  }
}

/** Null quando o id não existe OU pertence a outra empresa — não confirma existência. */
export function instanciaDaOrgRepo(orgId: string, id: string) {
  return prisma.instancia.findFirst({ where: { id, orgId } });
}

/**
 * Devolve o nome técnico removido (para desfazer na Evolution) ou `null` quando
 * a instância não existe ou é de outra empresa.
 */
export async function removerInstanciaRepo(orgId: string, id: string): Promise<string | null> {
  const alvo = await prisma.instancia.findFirst({
    where: { id, orgId },
    select: { id: true, evolutionInstance: true },
  });
  if (!alvo) return null;
  await prisma.instancia.delete({ where: { id: alvo.id } });
  return alvo.evolutionInstance;
}

// ─── Caminho do webhook ───────────────────────────────────────────────────────
// As duas funções abaixo não recebem `orgId`: elas o **descobrem**. O payload da
// Evolution traz só o nome técnico, e é dele que sai a empresa dona do evento.

export function porNomeTecnicoRepo(evolutionInstance: string) {
  return prisma.instancia.findUnique({ where: { evolutionInstance } });
}

export function atualizarStatusPorNomeTecnicoRepo(
  evolutionInstance: string,
  status: WhatsappStatus,
  numeroConectado?: string | null,
  ultimoErro?: string | null,
) {
  return prisma.instancia
    .update({
      where: { evolutionInstance },
      data: {
        status,
        ultimoEstadoEm: new Date(),
        ...(numeroConectado === undefined ? {} : { numeroConectado }),
        // Conectar limpa o erro anterior sozinho: o card não pode ficar mostrando
        // uma queda que já passou.
        ultimoErro: status === "CONNECTED" ? null : (ultimoErro ?? undefined),
      },
    })
    .catch(() => null); // instância removida no meio do polling não é erro
}
