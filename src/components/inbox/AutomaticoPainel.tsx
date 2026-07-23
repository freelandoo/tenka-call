"use client";

import { useEffect, useState } from "react";
import { Botao, Campo, Card } from "@/components/ui/primitives";
import type { InstanciaOpcao } from "@/components/inbox/InboxView";
import type { IAProvedor } from "@prisma/client";

interface ModeloIA {
  id: string;
  nome: string;
}

interface ConfigPublico {
  instanciaId: string;
  ativo: boolean;
  provedor: IAProvedor | null;
  modelo: string | null;
  temChave: boolean;
}

const PROVEDORES: { valor: IAProvedor; label: string }[] = [
  { valor: "claude", label: "Claude (Anthropic)" },
  { valor: "openai", label: "OpenAI" },
];

/**
 * Aba Automático: configura a IA de uma instância. Fluxo — escolhe o provedor,
 * cola a chave, clica Conectar (valida a chave e puxa os modelos), escolhe o
 * modelo e liga. A chave nunca volta do servidor; só o "tem chave" é conhecido.
 */
export function AutomaticoPainel({ instancias }: { instancias: InstanciaOpcao[] }) {
  const [instanciaId, setInstanciaId] = useState(instancias[0]?.id ?? "");
  const [config, setConfig] = useState<ConfigPublico | null>(null);
  const [provedor, setProvedor] = useState<IAProvedor>("claude");
  const [chave, setChave] = useState("");
  const [modelos, setModelos] = useState<ModeloIA[]>([]);
  const [modelo, setModelo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Carrega a config da instância selecionada. Inline no effect (como o inbox):
  // o setState só acontece depois do await, não no corpo síncrono do effect.
  useEffect(() => {
    if (!instanciaId) return;
    let ativo = true;
    const carregar = async () => {
      try {
        const r = await fetch(`/api/ia/config?instancia=${instanciaId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { config: ConfigPublico };
        if (!ativo) return;
        setConfig(d.config);
        if (d.config.provedor) setProvedor(d.config.provedor);
        setModelo(d.config.modelo ?? "");
      } catch {
        // rede instável: fica no estado anterior
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [instanciaId]);

  async function conectar() {
    setCarregando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ia/conectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanciaId, provedor, apiKey: chave }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.erro ?? "Falha ao conectar." });
        return;
      }
      setModelos(d.modelos ?? []);
      setConfig(d.config);
      setChave("");
      setMsg({ tipo: "ok", texto: `Conectado — ${d.modelos?.length ?? 0} modelos disponíveis.` });
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(dados: { modelo?: string; ativo?: boolean }) {
    setMsg(null);
    const r = await fetch("/api/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanciaId, ...dados }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg({ tipo: "erro", texto: d.erro ?? "Falha ao salvar." });
      return;
    }
    setConfig(d.config);
    if (dados.modelo !== undefined) setMsg({ tipo: "ok", texto: "Modelo salvo." });
  }

  if (instancias.length === 0) {
    return (
      <Card className="px-5 py-16 text-center">
        <p className="text-sm text-[var(--color-fraco)]">
          Nenhuma instância ainda. Pareie um número em Instâncias para configurar o atendimento
          automático.
        </p>
      </Card>
    );
  }

  const temModelosParaEscolher = modelos.length > 0 || !!config?.modelo;

  return (
    <div className="grid max-w-2xl gap-4">
      {instancias.length > 1 && (
        <label className="text-xs text-[var(--color-fraco)]">
          <span className="mr-2 uppercase tracking-wide">Instância</span>
          <select
            value={instanciaId}
            onChange={(e) => {
              // Troca de instância limpa o estado transitório antes de recarregar.
              setModelos([]);
              setChave("");
              setMsg(null);
              setInstanciaId(e.target.value);
            }}
            className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm text-[var(--color-texto)] outline-none"
          >
            {instancias.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Atendimento automático</p>
            <p className="text-xs text-[var(--color-fraco)]">
              A IA responde os leads sozinha nesta instância
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config?.ativo ?? false}
            disabled={!config?.temChave || !config?.modelo}
            onClick={() => salvar({ ativo: !config?.ativo })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
              config?.ativo ? "bg-[var(--color-acento)]" : "bg-[var(--color-borda)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                config?.ativo ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {(!config?.temChave || !config?.modelo) && (
          <p className="text-xs text-[var(--color-fraco)]">
            Conecte uma API e escolha um modelo para poder ligar.
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium">Conexão com a IA</p>
          <p className="text-xs text-[var(--color-fraco)]">
            {config?.temChave
              ? `Chave configurada${config.provedor ? ` (${config.provedor})` : ""}. Cole uma nova para trocar.`
              : "Cole a chave da API e clique Conectar para puxar os modelos."}
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
            Provedor
          </span>
          <select
            value={provedor}
            onChange={(e) => setProvedor(e.target.value as IAProvedor)}
            className="w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm text-[var(--color-texto)] outline-none"
          >
            {PROVEDORES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <Campo
          rotulo="Chave da API"
          type="password"
          autoComplete="off"
          placeholder={config?.temChave ? "•••••••••• (já configurada)" : "cole a chave aqui"}
          value={chave}
          onChange={(e) => setChave(e.target.value)}
        />

        <Botao onClick={conectar} disabled={carregando || !chave.trim()}>
          {carregando ? "Conectando…" : "Conectar"}
        </Botao>
      </Card>

      {temModelosParaEscolher && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Modelo</p>
          <select
            value={modelo}
            onChange={(e) => {
              setModelo(e.target.value);
              if (e.target.value) void salvar({ modelo: e.target.value });
            }}
            className="w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm text-[var(--color-texto)] outline-none"
          >
            <option value="">Escolha um modelo…</option>
            {/* Modelo já salvo aparece mesmo sem reconectar. */}
            {config?.modelo && !modelos.some((m) => m.id === config.modelo) && (
              <option value={config.modelo}>{config.modelo}</option>
            )}
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Card>
      )}

      {msg && (
        <p
          className={`text-sm ${
            msg.tipo === "ok" ? "text-emerald-400" : "text-red-300"
          }`}
        >
          {msg.texto}
        </p>
      )}
    </div>
  );
}
