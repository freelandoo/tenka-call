"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/ui/primitives";
import { ConversaPainel } from "@/components/inbox/ConversaPainel";
import { INTERESSE_LABEL } from "@/lib/whatsapp/rotulos";
import type { ConversaResumo } from "@/lib/repositories/conversas";
import type { ConversaInteresse, WhatsappStatus } from "@prisma/client";

const POLL_LISTA_MS = 5_000;

const PONTO: Record<ConversaInteresse, string> = {
  nao_classificado: "bg-[var(--color-borda)]",
  com_interesse: "bg-[var(--color-acento)]",
  sem_interesse: "bg-amber-400",
  perdido: "bg-[var(--color-borda)]",
  convertido: "bg-emerald-400",
};

export interface InstanciaOpcao {
  id: string;
  nome: string;
  status: WhatsappStatus;
}

function quando(iso: string) {
  const d = new Date(iso);
  const mesmoDia = d.toDateString() === new Date().toDateString();
  return mesmoDia
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Contador de não lidas com a mudança animada — o número que sobe chama atenção. */
function ContadorNaoLidas({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { scale: 0.6, opacity: 0.4 },
          { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" },
        );
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [valor] },
  );

  return (
    <span
      ref={ref}
      className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-[var(--color-acento)] px-1 text-[10px] font-semibold text-[#04202a]"
    >
      {valor}
    </span>
  );
}

/**
 * Inbox: lista à esquerda, conversa à direita. Atualiza por polling — uma equipe
 * de atendimento não justifica SSE nem WebSocket, e polling não precisa de infra.
 */
export function InboxView({
  inicial,
  instancias,
}: {
  inicial: ConversaResumo[];
  instancias: InstanciaOpcao[];
}) {
  // `?c=<id>` permite linkar direto para uma conversa.
  const alvo = useSearchParams().get("c");
  const [conversas, setConversas] = useState(inicial);
  const [filtro, setFiltro] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(
    (alvo && inicial.some((c) => c.id === alvo) ? alvo : inicial[0]?.id) ?? null,
  );
  const lista = useRef<HTMLUListElement>(null);

  const buscar = useCallback(async (instanciaId: string) => {
    try {
      const url = instanciaId ? `/api/conversas?instancia=${instanciaId}` : "/api/conversas";
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      const d = (await r.json()) as { conversas: ConversaResumo[] };
      return d.conversas ?? [];
    } catch {
      return null; // rede instável: a próxima volta resolve
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    const puxar = async () => {
      const lista = await buscar(filtro);
      if (ativo && lista) setConversas(lista);
    };
    const t = setInterval(puxar, POLL_LISTA_MS);
    void puxar();
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [filtro, buscar]);

  // Entrada escalonada da lista, uma vez por montagem.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(lista.current?.children ?? [], {
          opacity: 0,
          y: 10,
          duration: 0.35,
          stagger: 0.03,
          ease: "power2.out",
        });
      });
      return () => mm.revert();
    },
    { scope: lista },
  );

  const atual = conversas.find((c) => c.id === selecionada) ?? null;
  const mostrarInstancia = instancias.length > 1;

  function atualizarConversa(c: ConversaResumo) {
    setConversas((antigas) => antigas.map((a) => (a.id === c.id ? { ...a, ...c } : a)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-sm text-[var(--color-fraco)]">
            Toda conversa recebida vira lead e fica registrada aqui
          </p>
        </div>
        {mostrarInstancia && (
          <label className="text-xs text-[var(--color-fraco)]">
            <span className="mr-2 uppercase tracking-wide">Instância</span>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm text-[var(--color-texto)] outline-none"
            >
              <option value="">Todas</option>
              {instancias.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {conversas.length === 0 ? (
        <Card className="px-5 py-16 text-center">
          <p className="text-sm text-[var(--color-fraco)]">
            {instancias.some((i) => i.status === "CONNECTED")
              ? "Nenhuma conversa ainda. Quando alguém chamar no WhatsApp, o lead e o histórico aparecem aqui sozinhos."
              : "Nenhuma instância conectada. Pareie um número em Instâncias para começar a receber."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="max-h-[72dvh] overflow-y-auto p-0">
            <ul ref={lista}>
              {conversas.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setSelecionada(c.id);
                      // Abrir zera o badge; o servidor faz o mesmo no GET.
                      setConversas((a) =>
                        a.map((x) => (x.id === c.id ? { ...x, naoLidas: 0 } : x)),
                      );
                    }}
                    className={`flex w-full items-start gap-3 border-b border-[var(--color-borda)] px-4 py-3 text-left transition-colors last:border-0 ${
                      c.id === selecionada
                        ? "bg-[var(--color-acento)]/10"
                        : "hover:bg-[var(--color-borda)]/40"
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PONTO[c.interesse]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.nome}</span>
                        <span className="shrink-0 text-[11px] text-[var(--color-fraco)]">
                          {quando(c.ultimaMensagemEm)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-[var(--color-fraco)]">
                          {c.preview || c.telefone}
                        </span>
                        {c.naoLidas > 0 && <ContadorNaoLidas valor={c.naoLidas} />}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-fraco)]">
                        {mostrarInstancia && (
                          <span className="rounded border border-[var(--color-borda)] px-1.5 py-0.5">
                            {c.instanciaNome}
                          </span>
                        )}
                        {c.interesse !== "nao_classificado" && (
                          <span className="uppercase tracking-wide">
                            {INTERESSE_LABEL[c.interesse]}
                          </span>
                        )}
                        {c.ultimoRegistro && (
                          <span className="truncate">· {c.ultimoRegistro.usuario}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="h-[72dvh] overflow-hidden p-0">
            {atual ? (
              <ConversaPainel
                key={atual.id}
                conversa={atual}
                onConversaAtualizada={atualizarConversa}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-[var(--color-fraco)]">
                Escolha uma conversa à esquerda.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
