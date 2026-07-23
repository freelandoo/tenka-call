"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Botao } from "@/components/ui/primitives";
import { INTERESSE_LABEL } from "@/lib/whatsapp/rotulos";
import type { ConversaResumo, MensagemItem, RegistroItem } from "@/lib/repositories/conversas";
import type { ConversaInteresse } from "@prisma/client";

const POLL_THREAD_MS = 3_000;

const campoCls =
  "w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 py-2 text-sm " +
  "text-[var(--color-texto)] outline-none transition-colors focus:border-[var(--color-acento)]";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Histórico da conversa + resposta manual + classificação do atendimento. */
export function ConversaPainel({
  conversa,
  onConversaAtualizada,
}: {
  conversa: ConversaResumo;
  onConversaAtualizada: (c: ConversaResumo) => void;
}) {
  const [mensagens, setMensagens] = useState<MensagemItem[]>([]);
  const [atendimentos, setAtendimentos] = useState<RegistroItem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const fim = useRef<HTMLDivElement>(null);

  // Carrega o histórico ao montar. Trocar de conversa remonta o componente
  // (a lista passa `key={id}`), então não há estado antigo para limpar aqui.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await fetch(`/api/conversas/${conversa.id}`, { cache: "no-store" });
        const d = (await r.json()) as {
          erro?: string;
          mensagens?: MensagemItem[];
          atendimentos?: RegistroItem[];
        };
        if (!ativo) return;
        if (r.ok) {
          setMensagens(d.mensagens ?? []);
          setAtendimentos(d.atendimentos ?? []);
        } else {
          setErro(d?.erro ?? "Não foi possível abrir a conversa.");
        }
      } catch {
        if (ativo) setErro("Falha de conexão.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [conversa.id]);

  // Polling incremental: pede só o que chegou depois da última mensagem.
  useEffect(() => {
    const t = setInterval(async () => {
      const ultima = mensagens[mensagens.length - 1]?.enviadaEm;
      const url = `/api/conversas/${conversa.id}/mensagens${
        ultima ? `?depois=${encodeURIComponent(ultima)}` : ""
      }`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { mensagens: MensagemItem[] };
        if (d.mensagens?.length) {
          setMensagens((antigas) => {
            const vistos = new Set(antigas.map((m) => m.id));
            return [...antigas, ...d.mensagens.filter((m) => !vistos.has(m.id))];
          });
        }
      } catch {
        /* rede instável: próxima volta resolve */
      }
    }, POLL_THREAD_MS);
    return () => clearInterval(t);
  }, [conversa.id, mensagens]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  async function responder() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch(`/api/conversas/${conversa.id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: conteudo }),
      });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; mensagens?: MensagemItem[] };
      if (r.ok) {
        setMensagens(d.mensagens ?? []);
        setTexto("");
      } else {
        // Falha de envio grava a bolha marcada como não entregue: o texto não some.
        setErro(d?.erro ?? "Não foi possível enviar.");
      }
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  async function classificar(interesse: ConversaInteresse, observacao: string, motivo: string) {
    const r = await fetch(`/api/conversas/${conversa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interesse, observacao, motivoPerdido: motivo }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      erro?: string;
      conversa?: ConversaResumo;
      atendimentos?: RegistroItem[];
    };
    if (!r.ok || !d.conversa) {
      setErro(d?.erro ?? "Não foi possível salvar a classificação.");
      return false;
    }
    setAtendimentos(d.atendimentos ?? []);
    onConversaAtualizada(d.conversa);
    return true;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-borda)] px-5 py-4">
        <div>
          <p className="text-base font-semibold">{conversa.nome}</p>
          <p className="text-xs text-[var(--color-fraco)]">
            {conversa.telefone || "sem número"} · {conversa.instanciaNome}
            {conversa.atendente && ` · atendido por ${conversa.atendente}`}
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-borda)] px-2.5 py-1 text-xs text-[var(--color-fraco)]">
          {INTERESSE_LABEL[conversa.interesse]}
        </span>
      </header>

      <UltimoRegistro atendimentos={atendimentos} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {carregando ? (
          <p className="py-10 text-center text-sm text-[var(--color-fraco)]">Carregando conversa…</p>
        ) : mensagens.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-fraco)]">Nenhuma mensagem ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mensagens.map((m) => (
              <Bolha key={m.id} mensagem={m} />
            ))}
          </div>
        )}
        <div ref={fim} />
      </div>

      <ClassificarAtendimento atual={conversa.interesse} onSalvar={classificar} />

      <div className="border-t border-[var(--color-borda)] px-5 py-4">
        {conversa.temTelefone ? (
          <>
            <div className="flex gap-3">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void responder();
                  }
                }}
                rows={2}
                placeholder="Escreva a resposta… (Enter envia, Shift+Enter quebra linha)"
                className={`${campoCls} resize-none`}
              />
              <Botao
                className="shrink-0 self-end"
                onClick={() => void responder()}
                disabled={enviando || !texto.trim()}
              >
                {enviando ? "Enviando…" : "Enviar"}
              </Botao>
            </div>
            {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
          </>
        ) : (
          // @lid: o WhatsApp não expôs o número, e sem número não há como enviar.
          <p className="text-center text-xs text-[var(--color-fraco)]">
            Esta conversa não expõe o número de telefone. Responda pelo aparelho — e complete o
            número na ficha do lead para responder por aqui.
          </p>
        )}
      </div>
    </div>
  );
}

/** O último registro fica no topo; o histórico completo abre em um expandir. */
function UltimoRegistro({ atendimentos }: { atendimentos: RegistroItem[] }) {
  const [aberto, setAberto] = useState(false);
  const ultimo = atendimentos[0];
  if (!ultimo) return null;

  return (
    <div className="border-b border-[var(--color-borda)] bg-[var(--color-fundo)]/40 px-5 py-3">
      <p className="text-xs text-[var(--color-fraco)]">
        <span className="text-[var(--color-texto)]">{INTERESSE_LABEL[ultimo.interesse]}</span> por{" "}
        {ultimo.usuario} em {new Date(ultimo.criadoEm).toLocaleString("pt-BR")}
        {ultimo.observacao && ` — ${ultimo.observacao}`}
      </p>
      {atendimentos.length > 1 && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            className="mt-1 text-[11px] text-[var(--color-acento)] hover:underline"
          >
            {aberto ? "Esconder histórico" : `Ver os ${atendimentos.length} registros`}
          </button>
          {aberto && (
            <ul className="mt-2 space-y-1 border-l border-[var(--color-borda)] pl-3">
              {atendimentos.slice(1).map((r) => (
                <li key={r.id} className="text-[11px] text-[var(--color-fraco)]">
                  {INTERESSE_LABEL[r.interesse]} por {r.usuario} em{" "}
                  {new Date(r.criadoEm).toLocaleString("pt-BR")}
                  {r.observacao && ` — ${r.observacao}`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Bolha({ mensagem }: { mensagem: MensagemItem }) {
  const saida = mensagem.direcao === "OUT";
  const ref = useRef<HTMLDivElement>(null);

  // Bolha nova entra em fade + deslocamento curto — o movimento é o que faz a
  // mensagem que chegou pelo polling ser notada sem piscar a tela inteira.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, {
          opacity: 0,
          y: 8,
          x: saida ? 8 : -8,
          duration: 0.3,
          ease: "power2.out",
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`flex ${saida ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl border px-3.5 py-2 ${
          saida
            ? "border-[var(--color-acento)]/30 bg-[var(--color-acento)]/10"
            : "border-[var(--color-borda)] bg-[var(--color-fundo)]"
        } ${mensagem.erro ? "border-red-500/60" : ""}`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{mensagem.texto}</p>
        <p className="mt-1 text-right text-[11px] text-[var(--color-fraco)]">
          {saida && (mensagem.autorNome ?? "pelo aparelho")}
          {saida && " · "}
          {hora(mensagem.enviadaEm)}
          {mensagem.erro && <span className="text-red-400"> · não entregue</span>}
        </p>
      </div>
    </div>
  );
}

const OPCOES = Object.entries(INTERESSE_LABEL) as [ConversaInteresse, string][];

/** Cadastro de atendimento: quem atendeu, o que classificou e o que ficou combinado. */
function ClassificarAtendimento({
  atual,
  onSalvar,
}: {
  atual: ConversaInteresse;
  onSalvar: (i: ConversaInteresse, obs: string, motivo: string) => Promise<boolean>;
}) {
  const [interesse, setInteresse] = useState<ConversaInteresse>(atual);
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setSalvando(true);
    setOk(false);
    const sucesso = await onSalvar(interesse, observacao, motivo);
    setSalvando(false);
    if (sucesso) {
      setObservacao("");
      setMotivo("");
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    }
  }

  return (
    <div className="border-t border-[var(--color-borda)] px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[170px]">
          <span className="mb-1 block text-xs text-[var(--color-fraco)]">Interesse</span>
          <select
            value={interesse}
            onChange={(e) => setInteresse(e.target.value as ConversaInteresse)}
            className={campoCls}
          >
            {OPCOES.map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {interesse === "perdido" && (
          <label className="min-w-[170px] flex-1">
            <span className="mb-1 block text-xs text-[var(--color-fraco)]">Motivo</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Preço, prazo, foi para o concorrente…"
              className={campoCls}
            />
          </label>
        )}

        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-[var(--color-fraco)]">Observação</span>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="O que ficou combinado"
            className={campoCls}
          />
        </label>

        <Botao variante="secundario" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : ok ? "Registrado ✓" : "Registrar"}
        </Botao>
      </div>
    </div>
  );
}
