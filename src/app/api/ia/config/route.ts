import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { atualizarIAConfigRepo, obterIAConfigRepo } from "@/lib/repositories/iaConfig";

export const dynamic = "force-dynamic";

/** GET — config pública da IA de uma instância (`?instancia=<id>`), sem a chave. */
export async function GET(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const instanciaId = new URL(req.url).searchParams.get("instancia") ?? "";
  if (!instanciaId) return NextResponse.json({ erro: "informe a instância" }, { status: 400 });

  const config = await obterIAConfigRepo(g.user.orgId, instanciaId);
  if (!config) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });
  return NextResponse.json({ config });
}

/** PUT — escolhe o modelo e/ou liga/desliga a IA. Não mexe na chave. */
export async function PUT(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as {
    instanciaId?: unknown;
    modelo?: unknown;
    ativo?: unknown;
  };
  const instanciaId = typeof corpo.instanciaId === "string" ? corpo.instanciaId : "";
  if (!instanciaId) return NextResponse.json({ erro: "informe a instância" }, { status: 400 });

  const config = await atualizarIAConfigRepo(g.user.orgId, instanciaId, {
    ...(typeof corpo.modelo === "string" ? { modelo: corpo.modelo } : {}),
    ...(typeof corpo.ativo === "boolean" ? { ativo: corpo.ativo } : {}),
  });
  if (!config) return NextResponse.json({ erro: "configure a conexão primeiro" }, { status: 404 });
  return NextResponse.json({ config });
}
