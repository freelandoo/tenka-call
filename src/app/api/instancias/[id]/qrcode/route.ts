import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import {
  atualizarStatusPorNomeTecnicoRepo,
  instanciaDaOrgRepo,
} from "@/lib/repositories/instancias";
import { conectar, configEvolution } from "@/lib/whatsapp/evolution";
import { semConfig, tratarErro } from "@/lib/whatsapp/respostas";

export const dynamic = "force-dynamic";

/**
 * GET — QR Code para parear o aparelho. O modal chama repetidamente: o QR do
 * WhatsApp expira em ~20s, então cada chamada pede um novo à Evolution.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const cfg = configEvolution();
  if (!cfg) return semConfig();

  const { id } = await ctx.params;
  const instancia = await instanciaDaOrgRepo(g.user.orgId, id);
  if (!instancia) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });

  try {
    const r = await conectar(cfg, instancia.evolutionInstance);
    await atualizarStatusPorNomeTecnicoRepo(
      instancia.evolutionInstance,
      r.conectado ? "CONNECTED" : "CONNECTING",
    );
    return NextResponse.json(r);
  } catch (e) {
    return tratarErro(e);
  }
}
