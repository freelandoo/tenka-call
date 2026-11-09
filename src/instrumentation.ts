/**
 * Roda uma vez quando o servidor sobe (Next instrumentation): deixa a versão
 * do Node visível no log do Railway (segurança — Node fixo no Dockerfile).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  console.log(`[boot] node ${process.version}`);
}
