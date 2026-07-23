"use client";

import { useEffect, useState } from "react";
import { Botao, Card } from "@/components/ui/primitives";
import type { FechoTipo } from "@prisma/client";

interface Servico {
  nome: string;
  preco: string;
  descricao: string | null;
}

interface Playbook {
  objetivo: string;
  contexto: string;
  saudacaoAtiva: boolean;
  desenvolvimentoAtiva: boolean;
  agendamentoAtiva: boolean;
  fecho: FechoTipo;
  linkFecho: string;
  maxMensagensAuto: number;
  servicos: Servico[];
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm text-[var(--color-texto)] outline-none focus:border-[var(--color-acento)]";

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
      {children}
    </span>
  );
}

function Toggle({
  ligado,
  onToggle,
  titulo,
  sub,
}: {
  ligado: boolean;
  onToggle: () => void;
  titulo: string;
  sub: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <p className="text-sm">{titulo}</p>
        <p className="text-xs text-[var(--color-fraco)]">{sub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          ligado ? "bg-[var(--color-acento)]" : "bg-[var(--color-borda)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            ligado ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Editor do playbook da instância: o roteiro que a IA segue. É o "conhecimento
 * do negócio" — serviços, preços, objetivo e contexto — mais quais estágios
 * entram e como fechar. A IA não inventa nada fora daqui.
 */
export function PlaybookEditor({ instanciaId }: { instanciaId: string }) {
  const [pb, setPb] = useState<Playbook | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    if (!instanciaId) return;
    let ativo = true;
    const carregar = async () => {
      try {
        const r = await fetch(`/api/ia/playbook?instancia=${instanciaId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { playbook: Playbook };
        if (ativo) setPb(d.playbook);
      } catch {
        // rede instável: fica no estado anterior
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [instanciaId]);

  if (!pb) return null;

  const set = <K extends keyof Playbook>(campo: K, valor: Playbook[K]) =>
    setPb((p) => (p ? { ...p, [campo]: valor } : p));

  const setServico = (i: number, campo: keyof Servico, valor: string) =>
    setPb((p) =>
      p ? { ...p, servicos: p.servicos.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)) } : p,
    );

  const addServico = () =>
    set("servicos", [...pb.servicos, { nome: "", preco: "", descricao: "" }]);
  const removerServico = (i: number) =>
    set(
      "servicos",
      pb.servicos.filter((_, j) => j !== i),
    );

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ia/playbook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanciaId, ...pb }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.erro ?? "Falha ao salvar." });
        return;
      }
      setPb(d.playbook);
      setMsg({ tipo: "ok", texto: "Playbook salvo." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm font-medium">Playbook</p>
        <p className="text-xs text-[var(--color-fraco)]">
          O roteiro que a IA segue. Ela só usa o que estiver aqui — não inventa preço nem serviço.
        </p>
      </div>

      <label className="block">
        <Rotulo>Objetivo do atendimento</Rotulo>
        <input
          className={INPUT}
          placeholder="Ex.: vender criação de site e agendar reunião"
          value={pb.objetivo}
          onChange={(e) => set("objetivo", e.target.value)}
        />
      </label>

      {/* Serviços e preços */}
      <div className="space-y-2">
        <Rotulo>Serviços e preços</Rotulo>
        {pb.servicos.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              className={`${INPUT} min-w-[8rem] flex-1`}
              placeholder="Serviço"
              value={s.nome}
              onChange={(e) => setServico(i, "nome", e.target.value)}
            />
            <input
              className={`${INPUT} min-w-[8rem] flex-1`}
              placeholder="Preço (ex.: a partir de R$299)"
              value={s.preco}
              onChange={(e) => setServico(i, "preco", e.target.value)}
            />
            <input
              className={`${INPUT} min-w-[8rem] flex-1`}
              placeholder="Descrição (opcional)"
              value={s.descricao ?? ""}
              onChange={(e) => setServico(i, "descricao", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removerServico(i)}
              className="rounded-lg border border-red-500/40 px-2 py-2 text-xs text-red-300 hover:bg-red-500/10"
            >
              remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addServico}
          className="text-xs font-medium text-[var(--color-acento)] hover:underline"
        >
          + adicionar serviço
        </button>
      </div>

      <label className="block">
        <Rotulo>Contexto do negócio (cole aqui valores, regras e diferenciais)</Rotulo>
        <textarea
          className={`${INPUT} min-h-28 resize-y`}
          placeholder="Cole as informações do seu negócio — pode colar o conteúdo de um PDF. A IA usa isto como base para responder."
          value={pb.contexto}
          onChange={(e) => set("contexto", e.target.value)}
        />
      </label>

      {/* Estágios */}
      <div>
        <Rotulo>Estágios da conversa</Rotulo>
        <div className="divide-y divide-[var(--color-borda)]">
          <Toggle
            ligado={pb.saudacaoAtiva}
            onToggle={() => set("saudacaoAtiva", !pb.saudacaoAtiva)}
            titulo="Saudação"
            sub="Abre a conversa e desperta interesse"
          />
          <Toggle
            ligado={pb.desenvolvimentoAtiva}
            onToggle={() => set("desenvolvimentoAtiva", !pb.desenvolvimentoAtiva)}
            titulo="Desenvolvimento"
            sub="Apresenta serviço, preço e contorna objeção"
          />
          <Toggle
            ligado={pb.agendamentoAtiva}
            onToggle={() => set("agendamentoAtiva", !pb.agendamentoAtiva)}
            titulo="Fecho"
            sub="Fecha a conversa (reunião ou link)"
          />
        </div>
      </div>

      {/* Fecho */}
      <div className="space-y-2">
        <Rotulo>Como fechar</Rotulo>
        <div className="flex gap-2">
          {(["reuniao", "link"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("fecho", f)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                pb.fecho === f
                  ? "border-[var(--color-acento)]/60 bg-[var(--color-acento)]/10 text-[var(--color-texto)]"
                  : "border-[var(--color-borda)] text-[var(--color-fraco)] hover:bg-[var(--color-superficie)]"
              }`}
            >
              {f === "reuniao" ? "Agendar reunião" : "Enviar link"}
            </button>
          ))}
        </div>
        {pb.fecho === "link" && (
          <input
            className={INPUT}
            placeholder="Link de cadastro (https://…)"
            value={pb.linkFecho}
            onChange={(e) => set("linkFecho", e.target.value)}
          />
        )}
      </div>

      <label className="block max-w-xs">
        <Rotulo>Máximo de mensagens automáticas por conversa</Rotulo>
        <input
          type="number"
          min={1}
          max={50}
          className={INPUT}
          value={pb.maxMensagensAuto}
          onChange={(e) => set("maxMensagensAuto", Number(e.target.value) || 1)}
        />
        <span className="mt-1 block text-xs text-[var(--color-fraco)]">
          Trava: depois disso a IA para sozinha e espera um humano.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar playbook"}
        </Botao>
        {msg && (
          <span className={`text-sm ${msg.tipo === "ok" ? "text-emerald-400" : "text-red-300"}`}>
            {msg.texto}
          </span>
        )}
      </div>
    </Card>
  );
}
