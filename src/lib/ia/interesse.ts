/**
 * Medição de interesse do lead (0 a 100) por palavras‑gatilho, e detecção de
 * handoff (quando o lead quer falar com uma pessoa). É de propósito simples e
 * transparente: a equipe consegue prever por que a nota subiu ou desceu.
 *
 * A nota parte de uma linha de base e anda a cada mensagem do lead. É um sinal
 * de triagem, não um veredito — a classificação de verdade continua sendo humana.
 */

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Gatilhos que SOBEM o interesse, com o peso de cada um. */
const POSITIVOS: { termo: string; peso: number }[] = [
  { termo: "quero", peso: 25 },
  { termo: "tenho interesse", peso: 25 },
  { termo: "me interessa", peso: 20 },
  { termo: "fechar", peso: 25 },
  { termo: "contratar", peso: 25 },
  { termo: "comprar", peso: 25 },
  { termo: "quanto", peso: 15 },
  { termo: "valor", peso: 15 },
  { termo: "preco", peso: 15 },
  { termo: "quanto custa", peso: 20 },
  { termo: "como funciona", peso: 12 },
  { termo: "como faco", peso: 12 },
  { termo: "agendar", peso: 20 },
  { termo: "reuniao", peso: 18 },
  { termo: "orcamento", peso: 18 },
  { termo: "prazo", peso: 8 },
  { termo: "sim", peso: 8 },
  { termo: "bora", peso: 12 },
  { termo: "vamos", peso: 10 },
  { termo: "pode ser", peso: 10 },
];

/** Gatilhos que DESCEM o interesse. */
const NEGATIVOS: { termo: string; peso: number }[] = [
  { termo: "nao tenho interesse", peso: 40 },
  { termo: "sem interesse", peso: 40 },
  { termo: "nao quero", peso: 30 },
  { termo: "para de", peso: 30 },
  { termo: "nao me manda", peso: 30 },
  { termo: "descadastr", peso: 40 },
  { termo: "spam", peso: 25 },
  { termo: "caro", peso: 12 },
  { termo: "depois", peso: 8 },
  { termo: "agora nao", peso: 15 },
  { termo: "nao", peso: 8 },
];

/** Pedidos de falar com gente de verdade — disparam o handoff. */
const HANDOFF: string[] = [
  "atendente",
  "falar com uma pessoa",
  "falar com alguem",
  "quero uma pessoa",
  "pessoa de verdade",
  "nao quero robo",
  "e um robo",
  "atendimento humano",
];

function conta(texto: string, termo: string): number {
  if (termo.includes(" ")) return texto.includes(termo) ? 1 : 0;
  // Palavra isolada: evita casar "nao" dentro de "naoentendi" ou "sim" em "assim".
  const re = new RegExp(`\\b${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  return (texto.match(re) ?? []).length;
}

export interface LeituraInteresse {
  /** Nova nota, já somada ao valor anterior e presa entre 0 e 100. */
  nota: number;
  /** Variação aplicada por esta mensagem (para log/depuração). */
  delta: number;
  /** O lead pediu para falar com um humano. */
  pedeHumano: boolean;
}

export function medirInteresse(textoLead: string, notaAtual: number): LeituraInteresse {
  const t = normalizar(textoLead);

  let delta = 0;
  for (const { termo, peso } of POSITIVOS) delta += conta(t, termo) * peso;
  for (const { termo, peso } of NEGATIVOS) delta -= conta(t, termo) * peso;

  const nota = Math.max(0, Math.min(100, notaAtual + delta));
  const pedeHumano = HANDOFF.some((frase) => t.includes(frase));

  return { nota, delta, pedeHumano };
}
