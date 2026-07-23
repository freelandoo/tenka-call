import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

/**
 * Teste de arquitetura, não de comportamento.
 *
 * DECISÃO DE PRODUTO (2026-07-23): passou a existir atendimento automático. O
 * envio a partir do webhook agora é permitido, mas confinado a UM módulo com
 * travas — `autoresposta.ts`. A garantia mudou de "ninguém envia" para:
 *
 *   1. O GRAVADOR (`ingest.ts`) continua sem alcançar o envio — nenhum caminho
 *      de gravação pode, sozinho, virar mensagem enviada.
 *   2. A partir do webhook, o envio só é alcançável via `autoresposta.ts`.
 *
 * Se (1) falhar, alguém ligou a gravação ao envio por fora do módulo cercado —
 * isso tem que ser uma decisão consciente, não um acidente de import.
 */

const RAIZ = resolve(__dirname, "../..");
const MODULO_DE_ENVIO = "@/lib/whatsapp/evolution";
const MODULO_AUTORESPOSTA = "@/lib/whatsapp/autoresposta";

/** Caminho de import interno → arquivo em disco. */
function arquivoDe(especificador: string): string | null {
  if (!especificador.startsWith("@/")) return null; // dependência externa
  return resolve(RAIZ, `${especificador.slice(2)}.ts`);
}

function importsDe(arquivo: string): string[] {
  const fonte = readFileSync(arquivo, "utf8");
  return [...fonte.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Fecho transitivo dos imports internos a partir de um arquivo. */
function alcancaveis(entrada: string): Set<string> {
  const vistos = new Set<string>();
  const fila = [entrada];
  while (fila.length) {
    const atual = fila.pop()!;
    for (const especificador of importsDe(atual)) {
      if (vistos.has(especificador)) continue;
      vistos.add(especificador);
      const arquivo = arquivoDe(especificador);
      if (arquivo) fila.push(arquivo);
    }
  }
  return vistos;
}

test("o gravador (ingest) não alcança o módulo que envia mensagens", () => {
  const dependencias = alcancaveis(resolve(RAIZ, "lib/whatsapp/ingest.ts"));
  expect([...dependencias]).not.toContain(MODULO_DE_ENVIO);
});

test("a partir do webhook, o envio só é alcançável via autoresposta", () => {
  const dependencias = alcancaveis(resolve(RAIZ, "app/api/webhooks/whatsapp/route.ts"));
  // O envio é alcançável (existe atendimento automático)...
  expect([...dependencias]).toContain(MODULO_DE_ENVIO);
  // ...e passa pelo módulo cercado. Como o ingest não alcança o envio (teste
  // acima) e a rota só importa ingest + autoresposta, o único caminho é este.
  expect([...dependencias]).toContain(MODULO_AUTORESPOSTA);
});

test("autoresposta é quem importa o envio (o módulo cercado)", () => {
  const dependencias = alcancaveis(resolve(RAIZ, "lib/whatsapp/autoresposta.ts"));
  expect([...dependencias]).toContain(MODULO_DE_ENVIO);
});

test("o teste sabe detectar o vínculo (controle negativo)", () => {
  // A rota de resposta manual importa o envio — se este caso não acusasse,
  // os dois testes acima estariam passando por engano.
  const dependencias = alcancaveis(resolve(RAIZ, "app/api/conversas/[id]/mensagens/route.ts"));
  expect([...dependencias]).toContain(MODULO_DE_ENVIO);
});
