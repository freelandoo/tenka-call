"use client";

import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/primitives";

export function SairBotao() {
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Botao variante="secundario" onClick={sair} className="w-full">
      Sair
    </Botao>
  );
}
