import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { obterPlaybookRepo, salvarPlaybookRepo, type ServicoItem } from "@/lib/repositories/playbook";
import type { FechoTipo } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET — playbook da instância (`?instancia=<id>`), com serviços e travas. */
export async function GET(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const instanciaId = new URL(req.url).searchParams.get("instancia") ?? "";
  if (!instanciaId) return NextResponse.json({ erro: "informe a instância" }, { status: 400 });

  const playbook = await obterPlaybookRepo(g.user.orgId, instanciaId);
  if (!playbook) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });
  return NextResponse.json({ playbook });
}

function ehFecho(v: unknown): v is FechoTipo {
  return v === "reuniao" || v === "link";
}

/** Serviços vêm como lista livre; saneia os tipos antes de gravar. */
function lerServicos(v: unknown): ServicoItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      nome: typeof o.nome === "string" ? o.nome : "",
      preco: typeof o.preco === "string" ? o.preco : "",
      descricao: typeof o.descricao === "string" ? o.descricao : null,
    };
  });
}

/** PUT — salva o playbook inteiro. */
export async function PUT(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const instanciaId = typeof c.instanciaId === "string" ? c.instanciaId : "";
  if (!instanciaId) return NextResponse.json({ erro: "informe a instância" }, { status: 400 });

  const ok = await salvarPlaybookRepo(g.user.orgId, instanciaId, {
    ...(typeof c.objetivo === "string" ? { objetivo: c.objetivo } : {}),
    ...(typeof c.contexto === "string" ? { contexto: c.contexto } : {}),
    ...(typeof c.saudacaoAtiva === "boolean" ? { saudacaoAtiva: c.saudacaoAtiva } : {}),
    ...(typeof c.desenvolvimentoAtiva === "boolean"
      ? { desenvolvimentoAtiva: c.desenvolvimentoAtiva }
      : {}),
    ...(typeof c.agendamentoAtiva === "boolean" ? { agendamentoAtiva: c.agendamentoAtiva } : {}),
    ...(ehFecho(c.fecho) ? { fecho: c.fecho } : {}),
    ...(typeof c.linkFecho === "string" ? { linkFecho: c.linkFecho } : {}),
    ...(typeof c.maxMensagensAuto === "number" ? { maxMensagensAuto: c.maxMensagensAuto } : {}),
    ...(lerServicos(c.servicos) ? { servicos: lerServicos(c.servicos) } : {}),
  });
  if (!ok) return NextResponse.json({ erro: "instância não encontrada" }, { status: 404 });

  return NextResponse.json({ playbook: await obterPlaybookRepo(g.user.orgId, instanciaId) });
}
