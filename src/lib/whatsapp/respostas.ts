/**
 * Respostas de erro compartilhadas pelas rotas que falam com a Evolution.
 * Ficam fora dos `route.ts` porque um route handler só pode exportar handlers.
 */

import { NextResponse } from "next/server";
import { EvolutionError } from "@/lib/whatsapp/evolution";

/** Sem credenciais o app continua de pé: a tela mostra o aviso e não quebra. */
export function semConfig() {
  return NextResponse.json(
    { erro: "WhatsApp não configurado. Defina EVOLUTION_URL e EVOLUTION_API_KEY." },
    { status: 503 },
  );
}

export function tratarErro(e: unknown) {
  if (e instanceof EvolutionError) return NextResponse.json({ erro: e.message }, { status: e.status });
  console.error("[whatsapp] erro ao falar com a Evolution", e);
  return NextResponse.json({ erro: "Falha ao falar com a Evolution." }, { status: 502 });
}
