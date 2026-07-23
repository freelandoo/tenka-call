"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/auth/papeis";
import { SairBotao } from "@/components/SairBotao";

const LINKS: { href: string; texto: string; papeis: Papel[] }[] = [
  { href: "/inbox", texto: "Inbox", papeis: ["ADMIN", "ATENDENTE"] },
  { href: "/leads", texto: "Leads", papeis: ["ADMIN", "ATENDENTE"] },
  { href: "/instancias", texto: "Instâncias", papeis: ["ADMIN"] },
  { href: "/equipe", texto: "Equipe", papeis: ["ADMIN"] },
  { href: "/perfil", texto: "Perfil", papeis: ["ADMIN", "ATENDENTE"] },
];

export function Sidebar({ nome, papel }: { nome: string; papel: Papel }) {
  const atual = usePathname();
  const visiveis = LINKS.filter((l) => l.papeis.includes(papel));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-borda)] p-4">
      <div className="mb-6">
        <p className="text-sm font-semibold">Tenka Call</p>
        <p className="text-xs text-[var(--color-fraco)]">{nome}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {visiveis.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              atual === l.href
                ? "bg-[var(--color-superficie)] text-[var(--color-acento)]"
                : "text-[var(--color-fraco)] hover:bg-[var(--color-superficie)]"
            }`}
          >
            {l.texto}
          </Link>
        ))}
      </nav>
      <SairBotao />
    </aside>
  );
}
