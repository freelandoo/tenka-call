/**
 * O nome técnico vai na URL da Evolution e é único no serviço inteiro — que é
 * compartilhado entre empresas. Prefixar com o slug da empresa evita que duas
 * empresas com uma instância "Comercial" briguem pelo mesmo recurso.
 */

export class NomeInstanciaInvalido extends Error {}

export function slugificar(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nomeTecnico(orgSlug: string, nomeAmigavel: string): string {
  const empresa = slugificar(orgSlug);
  const instancia = slugificar(nomeAmigavel);
  if (!empresa || !instancia) {
    throw new NomeInstanciaInvalido("Nome de instância inválido (use letras ou números).");
  }
  return `${empresa}-${instancia}`;
}

/** Nome vindo do banco também é validado: ele entra na URL da Evolution. */
export function validarNomeInstancia(nome: string): string {
  const limpo = String(nome ?? "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(limpo)) {
    throw new NomeInstanciaInvalido("Nome de instância inválido (use letras, números, _ e -).");
  }
  return limpo;
}
