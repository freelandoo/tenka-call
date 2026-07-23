"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo } from "@/components/ui/primitives";

export function FormLogin() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha }),
      });
      const data = (await r.json()) as { destino?: string; erro?: string };
      if (!r.ok) {
        setErro(data.erro ?? "não foi possível entrar");
        return;
      }
      router.replace(data.destino ?? "/");
      router.refresh();
    } catch {
      setErro("sem conexão com o servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo
        rotulo="Login"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        autoComplete="username"
        autoFocus
        required
      />
      <Campo
        rotulo="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
        required
      />
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <Botao type="submit" disabled={enviando} className="w-full">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
