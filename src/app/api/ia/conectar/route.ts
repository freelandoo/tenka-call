import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { ehProvedor, IAError, listarModelos } from "@/lib/ia/provedores";
import { obterIAConfigRepo, salvarConexaoIARepo } from "@/lib/repositories/iaConfig";

export const dynamic = "force-dynamic";

/**
 * POST — "Conectar": valida a chave listando os modelos do provedor, guarda
 * provedor+chave no servidor e devolve os modelos para a tela escolher.
 * A chave entra aqui e nunca volta: as respostas trazem só a config pública.
 */
export async function POST(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as {
    instanciaId?: unknown;
    provedor?: unknown;
    apiKey?: unknown;
  };
  const instanciaId = typeof corpo.instanciaId === "string" ? corpo.instanciaId : "";
  const apiKey = typeof corpo.apiKey === "string" ? corpo.apiKey : "";
  if (!instanciaId || !ehProvedor(corpo.provedor) || !apiKey.trim()) {
    return NextResponse.json({ erro: "informe instância, provedor e chave" }, { status: 400 });
  }

  try {
    // Valida a chave ANTES de gravar: chave ruim não fica salva.
    const modelos = await listarModelos(corpo.provedor, apiKey);
    const ok = await salvarConexaoIARepo(g.user.orgId, instanciaId, corpo.provedor, apiKey);
    if (!ok) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });

    return NextResponse.json({
      modelos,
      config: await obterIAConfigRepo(g.user.orgId, instanciaId),
    });
  } catch (e) {
    if (e instanceof IAError) return NextResponse.json({ erro: e.message }, { status: e.status });
    throw e;
  }
}
