"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo, Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";

export interface UsuarioLinha {
  id: string;
  login: string;
  nome: string;
  role: "ADMIN" | "ATENDENTE";
  ativo: boolean;
  senhaProvisoria: boolean;
}

export function EquipeView({ meuId, usuarios }: { meuId: string; usuarios: UsuarioLinha[] }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"ADMIN" | "ATENDENTE">("ATENDENTE");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, login, senha, role }),
      });
      const data = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(data.erro ?? "falha ao criar");
        return;
      }
      setNome("");
      setLogin("");
      setSenha("");
      setAbrindo(false);
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function alternarAtivo(u: UsuarioLinha) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      if (!r.ok) setErro(((await r.json()) as { erro?: string }).erro ?? "falha ao alterar");
      else router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function resetarSenha(u: UsuarioLinha) {
    const nova = window.prompt(`Nova senha provisória para ${u.nome} (mínimo 8 caracteres):`);
    if (!nova) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: nova }),
      });
      if (!r.ok) setErro(((await r.json()) as { erro?: string }).erro ?? "falha ao alterar");
      else router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipe</h1>
          <p className="text-sm text-[var(--color-fraco)]">Quem pode atender pelo Tenka Call</p>
        </div>
        <Botao onClick={() => setAbrindo((v) => !v)}>{abrindo ? "Cancelar" : "+ Novo usuário"}</Botao>
      </Reveal>

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {abrindo && (
        <Reveal>
          <Card>
            <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              <Campo rotulo="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
              <Campo
                rotulo="Senha provisória"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                required
              />
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
                  Papel
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "ATENDENTE")}
                  className="w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm outline-none"
                >
                  <option value="ATENDENTE">Atendente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <Botao type="submit" disabled={ocupado}>
                  Criar usuário
                </Botao>
              </div>
            </form>
          </Card>
        </Reveal>
      )}

      <div className="space-y-2">
        {usuarios.map((u, i) => (
          <Reveal key={u.id} delay={i * 0.04}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {u.nome}
                  {!u.ativo && (
                    <span className="ml-2 text-xs text-[var(--color-fraco)]">(desativado)</span>
                  )}
                  {u.senhaProvisoria && (
                    <span className="ml-2 text-xs text-amber-400">senha provisória</span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-fraco)]">
                  {u.login} · {u.role === "ADMIN" ? "Administrador" : "Atendente"}
                </p>
              </div>
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={() => resetarSenha(u)} disabled={ocupado}>
                  Resetar senha
                </Botao>
                {u.id !== meuId && (
                  <Botao
                    variante={u.ativo ? "perigo" : "secundario"}
                    onClick={() => alternarAtivo(u)}
                    disabled={ocupado}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Botao>
                )}
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
