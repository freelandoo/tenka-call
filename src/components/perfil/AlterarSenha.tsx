"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo, Card } from "@/components/ui/primitives";

export function AlterarSenha({ obrigatoria }: { obrigatoria: boolean }) {
  const router = useRouter();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/perfil/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atual, nova }),
      });
      const data = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: data.erro ?? "falha ao trocar a senha" });
        return;
      }
      setAtual("");
      setNova("");
      setMsg({ tipo: "ok", texto: "senha alterada" });
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold">Alterar senha</h2>
      {obrigatoria && (
        <p className="mb-3 text-xs text-amber-400">
          Sua senha é provisória. Defina uma nova para continuar.
        </p>
      )}
      <form onSubmit={enviar} className="space-y-3">
        <Campo
          rotulo="Senha atual"
          type="password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Campo
          rotulo="Nova senha"
          type="password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        {msg && (
          <p className={`text-sm ${msg.tipo === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {msg.texto}
          </p>
        )}
        <Botao type="submit" disabled={ocupado}>
          Salvar
        </Botao>
      </form>
    </Card>
  );
}
