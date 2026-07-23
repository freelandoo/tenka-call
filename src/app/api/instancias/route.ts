import { NextResponse } from "next/server";
import { exigirAdminApi, exigirSessaoApi } from "@/lib/auth/guards";
import {
  atualizarStatusPorNomeTecnicoRepo,
  criarInstanciaRepo,
  listarInstanciasRepo,
  removerInstanciaRepo,
} from "@/lib/repositories/instancias";
import {
  configEvolution,
  criarInstancia,
  estadoConexao,
  type ConfigEvolution,
} from "@/lib/whatsapp/evolution";
import { NomeInstanciaInvalido } from "@/lib/whatsapp/instancia";
import { semConfig, tratarErro } from "@/lib/whatsapp/respostas";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import type { Instancia, WhatsappStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function paraJson(i: Instancia, status: WhatsappStatus = i.status) {
  return {
    id: i.id,
    nome: i.nome,
    evolutionInstance: i.evolutionInstance,
    status,
    numero: formatarTelefone(i.numeroConectado),
    ultimoErro: i.ultimoErro,
    ultimoEstadoEm: i.ultimoEstadoEm?.toISOString() ?? null,
  };
}

/**
 * Reconciliação: a fonte da verdade é a Evolution, o banco é cache. Consulta
 * todas as instâncias em paralelo e tolera falha — `null` é "indisponível", e aí
 * preservamos o último status conhecido em vez de piscar "desconectado".
 * `CONNECTING` é preservado: quem está no meio do pareamento ainda não caiu.
 */
async function reconciliar(cfg: ConfigEvolution, instancias: Instancia[]): Promise<WhatsappStatus[]> {
  const estados = await Promise.allSettled(
    instancias.map((i) => estadoConexao(cfg, i.evolutionInstance)),
  );

  return Promise.all(
    instancias.map(async (i, n) => {
      const r = estados[n];
      const aberto = r.status === "fulfilled" ? r.value : null;
      if (aberto === null) return i.status;

      const status: WhatsappStatus = aberto
        ? "CONNECTED"
        : i.status === "CONNECTING"
          ? "CONNECTING"
          : "DISCONNECTED";
      if (status !== i.status) {
        await atualizarStatusPorNomeTecnicoRepo(i.evolutionInstance, status);
      }
      return status;
    }),
  );
}

/** GET — lista da empresa, com o status reconciliado contra a Evolution. */
export async function GET() {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const cfg = configEvolution();
  const instancias = await listarInstanciasRepo(g.user.orgId);
  const status = cfg ? await reconciliar(cfg, instancias) : instancias.map((i) => i.status);

  return NextResponse.json({
    configurado: !!cfg,
    instancias: instancias.map((i, n) => paraJson(i, status[n])),
  });
}

/** POST — cria a instância aqui e na Evolution, pronta para o QR. ADMIN. */
export async function POST(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as { nome?: unknown };
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  if (!nome) return NextResponse.json({ erro: "informe o nome da instância" }, { status: 400 });
  if (nome.length > 40) {
    return NextResponse.json({ erro: "nome longo demais (até 40 caracteres)" }, { status: 400 });
  }

  const cfg = configEvolution();
  if (!cfg) return semConfig();

  let criada;
  try {
    criada = await criarInstanciaRepo(g.user.orgId, g.user.org.slug, nome);
  } catch (e) {
    if (e instanceof NomeInstanciaInvalido) {
      return NextResponse.json({ erro: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "falha ao criar";
    return NextResponse.json({ erro: msg }, { status: msg.includes("já existe") ? 409 : 500 });
  }

  try {
    await criarInstancia(cfg, criada.evolutionInstance);
    return NextResponse.json({ instancia: paraJson(criada) }, { status: 201 });
  } catch (e) {
    // Nada fica meio-criado: sem instância na Evolution, a linha some daqui.
    await removerInstanciaRepo(g.user.orgId, criada.id).catch(() => undefined);
    return tratarErro(e);
  }
}
