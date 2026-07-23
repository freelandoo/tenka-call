import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { instanciaDaOrgRepo, removerInstanciaRepo } from "@/lib/repositories/instancias";
import { configEvolution, desconectar, removerInstancia } from "@/lib/whatsapp/evolution";
import { tratarErro } from "@/lib/whatsapp/respostas";

export const dynamic = "force-dynamic";

/**
 * DELETE — desconecta o aparelho e remove a instância, aqui e na Evolution.
 * As conversas daquele número vão junto (cascade); o lead continua no cadastro.
 * ADMIN.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  // Instância de outra empresa cai aqui como "não encontrada": 404, não 403.
  const instancia = await instanciaDaOrgRepo(g.user.orgId, id);
  if (!instancia) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });

  const cfg = configEvolution();
  if (cfg) {
    try {
      await desconectar(cfg, instancia.evolutionInstance);
    } catch (e) {
      // Sessão já caída não impede a remoção; falha de rede, sim — senão a
      // instância ficaria órfã na Evolution com o nome técnico ocupado.
      return tratarErro(e);
    }
    await removerInstancia(cfg, instancia.evolutionInstance);
  }

  await removerInstanciaRepo(g.user.orgId, id);
  return NextResponse.json({ ok: true });
}
