export type Papel = "ADMIN" | "ATENDENTE";

const PAPEIS: readonly Papel[] = ["ADMIN", "ATENDENTE"];

export function podePapel(papel: Papel, exigidos: Papel[]): boolean {
  if (!PAPEIS.includes(papel)) return false;
  return exigidos.includes(papel);
}

/**
 * Onde cada papel cai ao entrar ou ao ser barrado de uma tela.
 * Na Fase 2 os dois passam a apontar para "/inbox".
 */
export function rotaInicial(papel: Papel): string {
  return papel === "ADMIN" ? "/equipe" : "/perfil";
}
