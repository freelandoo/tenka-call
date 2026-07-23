export type Papel = "ADMIN" | "ATENDENTE";

const PAPEIS: readonly Papel[] = ["ADMIN", "ATENDENTE"];

export function podePapel(papel: Papel, exigidos: Papel[]): boolean {
  if (!PAPEIS.includes(papel)) return false;
  return exigidos.includes(papel);
}

/**
 * Onde cada papel cai ao entrar ou ao ser barrado de uma tela.
 * Os dois caem no inbox: atender é o trabalho, e ADMIN também atende.
 */
export function rotaInicial(_papel: Papel): string {
  return "/inbox";
}
