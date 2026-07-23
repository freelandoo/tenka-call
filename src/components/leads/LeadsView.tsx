"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { ESTAGIO_LABEL } from "@/lib/whatsapp/rotulos";
import type { LeadResumo } from "@/lib/repositories/leads";
import type { LeadEstagio } from "@prisma/client";

const POLL_MS = 15_000;

type Filtro = "todos" | LeadEstagio;

/** Ordem do funil na tela: da entrada ao desfecho. */
const ORDEM: LeadEstagio[] = ["novo", "interesse", "qualificado", "convertido", "perdido"];

/** Cor do ponto por estágio — mesma linguagem visual do inbox. */
const PONTO: Record<LeadEstagio, string> = {
  novo: "bg-[var(--color-borda)]",
  interesse: "bg-[var(--color-acento)]",
  qualificado: "bg-amber-400",
  convertido: "bg-emerald-400",
  perdido: "bg-red-400/70",
};

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  balcao: "Balcão",
  indicacao: "Indicação",
  redes: "Redes",
};

function rotuloOrigem(origem: string): string {
  return ORIGEM_LABEL[origem] ?? origem.charAt(0).toUpperCase() + origem.slice(1);
}

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Banco de leads: chips por estágio com contagem + tabela. O funil acompanha a
 * classificação do inbox sozinho — aqui é só leitura e triagem por estágio.
 * Atualiza por polling, como o inbox: sem infra de tempo real.
 */
export function LeadsView({ inicial }: { inicial: LeadResumo[] }) {
  const [leads, setLeads] = useState(inicial);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/leads", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { leads: LeadResumo[] };
      setLeads(d.leads ?? []);
    } catch {
      // rede instável: a próxima volta resolve
    }
  }, []);

  useEffect(() => {
    const t = setInterval(buscar, POLL_MS);
    return () => clearInterval(t);
  }, [buscar]);

  const contagem = useMemo(() => {
    const c = { todos: leads.length } as Record<Filtro, number>;
    for (const e of ORDEM) c[e] = 0;
    for (const l of leads) c[l.estagio]++;
    return c;
  }, [leads]);

  const visiveis = useMemo(
    () => (filtro === "todos" ? leads : leads.filter((l) => l.estagio === filtro)),
    [filtro, leads],
  );

  const chips: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todos" },
    ...ORDEM.map((e) => ({ key: e, label: ESTAGIO_LABEL[e] })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-[var(--color-fraco)]">
          Todo contato que escreve vira lead e é classificado pelo atendimento
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const ativo = filtro === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setFiltro(chip.key)}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                ativo
                  ? "border-[var(--color-acento)]/60 bg-[var(--color-acento)]/10 text-[var(--color-texto)]"
                  : "border-[var(--color-borda)] text-[var(--color-fraco)] hover:bg-[var(--color-superficie)]"
              }`}
            >
              <span className="uppercase tracking-wide">{chip.label}</span>
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-semibold ${
                  ativo
                    ? "bg-[var(--color-acento)] text-[#04202a]"
                    : "bg-[var(--color-superficie)] text-[var(--color-fraco)]"
                }`}
              >
                {contagem[chip.key]}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        {visiveis.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-[var(--color-fraco)]">
            {leads.length === 0
              ? "Nenhum lead ainda. Quando alguém chamar no WhatsApp, o lead aparece aqui sozinho."
              : "Nenhum lead neste estágio."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-borda)] text-left">
                  <Th>Nome</Th>
                  <Th>Contato</Th>
                  <Th>Origem</Th>
                  <Th>Estágio</Th>
                  <Th>Entrada</Th>
                  <Th className="text-right">Ação</Th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--color-borda)] transition-colors last:border-0 hover:bg-[var(--color-borda)]/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{lead.nome}</p>
                      {lead.motivoPerdido && (
                        <p className="mt-0.5 text-xs text-[var(--color-fraco)]">
                          {lead.motivoPerdido}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fraco)]">
                      {lead.telefone || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fraco)]">
                      {rotuloOrigem(lead.origem)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PONTO[lead.estagio]}`} />
                        {ESTAGIO_LABEL[lead.estagio]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fraco)]">{quando(lead.criadoEm)}</td>
                    <td className="px-4 py-3 text-right">
                      {lead.conversaId ? (
                        <Link
                          href={`/inbox?c=${lead.conversaId}`}
                          className="text-xs font-medium text-[var(--color-acento)] hover:underline"
                        >
                          Responder →
                        </Link>
                      ) : lead.telefoneCru ? (
                        <a
                          href={`https://wa.me/${lead.telefoneCru}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[var(--color-fraco)] hover:text-[var(--color-texto)] hover:underline"
                        >
                          WhatsApp →
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-fraco)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-fraco)] ${className}`}
    >
      {children}
    </th>
  );
}
