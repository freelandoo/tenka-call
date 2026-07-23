"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Botao, Campo, Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { ModalQrCode } from "@/components/instancias/ModalQrCode";

export interface InstanciaLinha {
  id: string;
  nome: string;
  evolutionInstance: string;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  numero: string;
  ultimoErro: string | null;
  ultimoEstadoEm: string | null;
}

const ROTULO = {
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
} as const;

const CORES = {
  DISCONNECTED: "border-[var(--color-borda)] text-[var(--color-fraco)]",
  CONNECTING: "border-amber-500/40 text-amber-300",
  CONNECTED: "border-emerald-500/40 text-emerald-300",
} as const;

/** Pulso no chip quando a instância acaba de conectar — só isso muda de estado. */
function ChipStatus({ status }: { status: InstanciaLinha["status"] }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (status !== "CONNECTED") return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { scale: 1 },
          { scale: 1.12, duration: 0.28, yoyo: true, repeat: 1, ease: "power2.out" },
        );
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [status] },
  );

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${CORES[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "CONNECTED"
            ? "bg-emerald-400"
            : status === "CONNECTING"
              ? "bg-amber-400"
              : "bg-[var(--color-fraco)]"
        }`}
      />
      {ROTULO[status]}
    </span>
  );
}

export function InstanciasView({
  configurado,
  inicial,
}: {
  configurado: boolean;
  inicial: InstanciaLinha[];
}) {
  const [instancias, setInstancias] = useState(inicial);
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [parear, setParear] = useState<InstanciaLinha | null>(null);

  /**
   * Reconciliação: a página nasce com o status do banco e, logo depois, o
   * servidor confere cada instância contra a Evolution e corrige as divergentes.
   */
  const recarregar = useCallback(async () => {
    try {
      const r = await fetch("/api/instancias", { cache: "no-store" });
      if (!r.ok) return null;
      const d = (await r.json()) as { instancias: InstanciaLinha[] };
      return d.instancias;
    } catch {
      return null; // rede instável: fica o último estado conhecido
    }
  }, []);

  useEffect(() => {
    if (!configurado) return;
    let ativo = true;
    recarregar().then((lista) => {
      if (ativo && lista) setInstancias(lista);
    });
    return () => {
      ativo = false;
    };
  }, [configurado, recarregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/instancias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const d = (await r.json()) as { erro?: string; instancia?: InstanciaLinha };
      if (!r.ok || !d.instancia) {
        setErro(d.erro ?? "falha ao criar a instância");
        return;
      }
      setInstancias((atual) => [...atual, d.instancia!]);
      setNome("");
      setAbrindo(false);
      // Instância recém-criada já abre no QR: é o próximo passo óbvio.
      setParear(d.instancia);
    } finally {
      setOcupado(false);
    }
  }

  async function remover(i: InstanciaLinha) {
    const certeza = window.confirm(
      `Remover "${i.nome}"? As conversas recebidas por esse número saem junto. Os leads continuam no cadastro.`,
    );
    if (!certeza) return;

    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`/api/instancias/${i.id}`, { method: "DELETE" });
      if (!r.ok) {
        setErro(((await r.json()) as { erro?: string }).erro ?? "falha ao remover");
        return;
      }
      setInstancias((atual) => atual.filter((x) => x.id !== i.id));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Instâncias</h1>
          <p className="text-sm text-[var(--color-fraco)]">Os números de WhatsApp da empresa</p>
        </div>
        {configurado && (
          <Botao onClick={() => setAbrindo((v) => !v)}>
            {abrindo ? "Cancelar" : "+ Nova instância"}
          </Botao>
        )}
      </Reveal>

      {!configurado && (
        <Reveal>
          <Card>
            <p className="text-sm">WhatsApp não configurado.</p>
            <p className="mt-1 text-xs text-[var(--color-fraco)]">
              Defina <code>EVOLUTION_URL</code> e <code>EVOLUTION_API_KEY</code> no ambiente para
              criar e parear instâncias. O resto do sistema continua funcionando.
            </p>
          </Card>
        </Reveal>
      )}

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {abrindo && (
        <Reveal>
          <Card>
            <form onSubmit={criar} className="flex items-end gap-3">
              <div className="flex-1">
                <Campo
                  rotulo="Nome da instância"
                  placeholder="Comercial, Suporte, Pós-venda…"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>
              <Botao type="submit" disabled={ocupado}>
                Criar e parear
              </Botao>
            </form>
          </Card>
        </Reveal>
      )}

      {instancias.length === 0 && configurado && !abrindo && (
        <Reveal>
          <Card>
            <p className="text-sm text-[var(--color-fraco)]">
              Nenhuma instância ainda. Crie a primeira e escaneie o QR Code com o celular da empresa.
            </p>
          </Card>
        </Reveal>
      )}

      <div className="space-y-2">
        {instancias.map((i, n) => (
          <Reveal key={i.id} delay={n * 0.04}>
            <Card className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {i.nome}
                  <ChipStatus status={i.status} />
                </p>
                <p className="truncate text-xs text-[var(--color-fraco)]">
                  {i.evolutionInstance}
                  {i.numero && ` · ${i.numero}`}
                </p>
                {i.status !== "CONNECTED" && i.ultimoErro && (
                  <p className="mt-1 text-xs text-amber-400">{i.ultimoErro}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Botao
                  variante={i.status === "CONNECTED" ? "secundario" : "primario"}
                  onClick={() => setParear(i)}
                  disabled={!configurado}
                >
                  {i.status === "CONNECTED" ? "Detalhes" : "Parear"}
                </Botao>
                <Botao variante="perigo" onClick={() => remover(i)} disabled={ocupado}>
                  Remover
                </Botao>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {parear && (
        <ModalQrCode
          instancia={parear}
          onFechar={() => {
            setParear(null);
            recarregar().then((lista) => lista && setInstancias(lista));
          }}
        />
      )}
    </div>
  );
}
