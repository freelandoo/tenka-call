import { NextResponse } from "next/server";
import { exigirSessaoApi } from "@/lib/auth/guards";
import { listarConversasRepo } from "@/lib/repositories/conversas";

export const dynamic = "force-dynamic";

/** GET — lista do inbox, da empresa da sessão. `?instancia=<id>` filtra o número. */
export async function GET(req: Request) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const instanciaId = new URL(req.url).searchParams.get("instancia") ?? undefined;
  // Instância de outra empresa simplesmente não casa com nada: a lista sai vazia,
  // porque o `orgId` do filtro vem da sessão.
  return NextResponse.json({
    conversas: await listarConversasRepo(g.user.orgId, { instanciaId: instanciaId || undefined }),
  });
}
