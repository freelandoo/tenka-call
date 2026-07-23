"use client";

import { useState } from "react";
import { InboxView, type InstanciaOpcao } from "@/components/inbox/InboxView";
import { AutomaticoPainel } from "@/components/inbox/AutomaticoPainel";
import type { ConversaResumo } from "@/lib/repositories/conversas";

type Aba = "conversas" | "automatico";

/**
 * Casca do Inbox com abas. "Conversas" é o inbox de sempre; "Automático" é a
 * configuração da IA por instância (colar chave → conectar → escolher modelo →
 * ligar). Só ADMIN vê a aba Automático.
 */
export function InboxWorkspace({
  inicial,
  instancias,
  podeAutomatico,
}: {
  inicial: ConversaResumo[];
  instancias: InstanciaOpcao[];
  podeAutomatico: boolean;
}) {
  const [aba, setAba] = useState<Aba>("conversas");

  const abas: { key: Aba; label: string }[] = [
    { key: "conversas", label: "Conversas" },
    ...(podeAutomatico ? [{ key: "automatico" as const, label: "Automático" }] : []),
  ];

  return (
    <div className="space-y-4">
      {podeAutomatico && (
        <div className="flex gap-1 border-b border-[var(--color-borda)]">
          {abas.map((a) => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                aba === a.key
                  ? "border-[var(--color-acento)] text-[var(--color-acento)]"
                  : "border-transparent text-[var(--color-fraco)] hover:text-[var(--color-texto)]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {aba === "conversas" ? (
        <InboxView inicial={inicial} instancias={instancias} />
      ) : (
        <AutomaticoPainel instancias={instancias} />
      )}
    </div>
  );
}
