# Tenka Call — Fase 2: atendimento WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o WhatsApp ao Tenka Call: criar várias instâncias por empresa, parear por QR Code, receber toda conversa como lead registrado, responder manualmente, classificar o interesse e guardar o registro de atendimento.

**Architecture:** O webhook da Evolution é uma route handler que só grava — resolve a empresa pela instância (`payload.instance` → `Instancia.evolutionInstance` → `orgId`), nunca pelo payload. O envio vive num único módulo (`lib/whatsapp/evolution.ts`) que a ingestão não importa, e um teste de arquitetura falha se esse caminho de import aparecer. Status da instância se mantém por `CONNECTION_UPDATE` mais reconciliação na leitura da página.

**Tech Stack:** Next.js 16 App Router · Prisma 6 · Evolution API v2.3.7 · Redis (só para a Evolution) · GSAP · vitest.

**Spec:** `docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md`

**Base pronta (Fase 1):** `Org`/`User`/`Session` com auth por sessão opaca, guards
(`exigirUsuario`, `exigirPapel`, `exigirSessaoApi`, `exigirAdminApi`), repositório de
usuários escopado por `orgId`, `Reveal` (GSAP), primitivas (`Botao`, `Campo`, `Card`),
sidebar, `/login`, `/equipe`, `/perfil`. **As tabelas `Instancia`, `Lead`, `Conversa`,
`Mensagem` e `AtendimentoRegistro` já existem na migration `init`** — esta fase não
cria migration nova.

## Fonte do porte

O módulo equivalente roda em produção no Coliseu. Portar de
`C:\Users\Alex\Documents\Antigravity\Coliseu\coliseu-backend`:

| Origem (Coliseu) | Destino (Tenka Call) | Mudança |
| --- | --- | --- |
| `src/lib/whatsapp/telefone.ts` | igual | verbatim |
| `src/lib/whatsapp/payload.ts` | igual | verbatim |
| `src/lib/whatsapp/telefone.test.ts`, `payload.test.ts` | igual | verbatim |
| `src/lib/whatsapp/evolution.ts` | igual | tira `EVOLUTION_INSTANCE` do env — o nome vem do banco |
| `src/lib/whatsapp/ingest.ts` | igual | resolve instância+org pelo `evento.instance` |
| `src/lib/repositories/whatsapp.ts` | quebra em `instancias.ts` + `conversas.ts` | `orgId` em tudo; `Person` vira `Lead` |
| `src/lib/whatsapp/sem-automacao.test.ts` | igual | ajusta caminhos |
| `src/components/captacao/AtendimentoInbox.tsx` | `components/inbox/InboxView.tsx` | filtro por instância |
| `src/components/captacao/ConversaPainel.tsx` | `components/inbox/ConversaPainel.tsx` | mostra último registro |
| `src/components/captacao/ConectarWhatsapp.tsx` | `components/instancias/InstanciasView.tsx` | várias instâncias |

**Leia o arquivo de origem antes de escrever cada um.** O plano abaixo especifica só
o que muda; o resto é porte fiel, incluindo os comentários que explicam o porquê.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/whatsapp/telefone.ts` | normalizar, casar por últimos 8 dígitos, formatar, redigir em log |
| `src/lib/whatsapp/payload.ts` | ler o payload Baileys (puro, sem rede) |
| `src/lib/whatsapp/instancia.ts` | derivar e validar o nome técnico da instância |
| `src/lib/whatsapp/evolution.ts` | **único** módulo que fala com a Evolution (e o único que envia) |
| `src/lib/whatsapp/ingest.ts` | processar evento do webhook — só grava |
| `src/lib/repositories/instancias.ts` | CRUD de `Instancia`, sempre por `orgId` |
| `src/lib/repositories/conversas.ts` | conversa, lead automático, mensagens, classificação |
| `src/app/api/webhooks/whatsapp/route.ts` | recebe evento da Evolution |
| `src/app/api/instancias/route.ts` | GET lista (com reconciliação), POST cria |
| `src/app/api/instancias/[id]/route.ts` | DELETE (logout + remove) |
| `src/app/api/instancias/[id]/qrcode/route.ts` | GET QR / estado do pareamento |
| `src/app/api/conversas/route.ts` | GET lista do inbox |
| `src/app/api/conversas/[id]/route.ts` | GET detalhe, PATCH classificar |
| `src/app/api/conversas/[id]/mensagens/route.ts` | GET delta, POST responder |
| `src/app/(app)/instancias/page.tsx` + `components/instancias/*` | tela de instâncias |
| `src/app/(app)/inbox/page.tsx` + `components/inbox/*` | inbox |

---

## Task 1: Módulos puros de telefone e payload

**Files:**
- Create: `src/lib/whatsapp/telefone.ts`, `src/lib/whatsapp/payload.ts`
- Test: `src/lib/whatsapp/telefone.test.ts`, `src/lib/whatsapp/payload.test.ts`

- [ ] **Step 1: Copiar os testes do Coliseu**

Copiar verbatim de `coliseu-backend/src/lib/whatsapp/telefone.test.ts` e
`payload.test.ts`. Eles não dependem de banco nem de nada específico do Coliseu.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/whatsapp/
```

Esperado: FAIL — `Cannot find package '@/lib/whatsapp/telefone'`.

- [ ] **Step 3: Copiar os módulos**

Copiar verbatim `coliseu-backend/src/lib/whatsapp/telefone.ts` e `payload.ts`.
São puros e não referenciam nada do CRM de academia.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/whatsapp/
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/telefone.ts src/lib/whatsapp/payload.ts src/lib/whatsapp/telefone.test.ts src/lib/whatsapp/payload.test.ts
git commit -m "feat: leitura de payload Baileys e normalizacao de telefone"
```

---

## Task 2: Nome técnico da instância

**Files:**
- Create: `src/lib/whatsapp/instancia.ts`
- Test: `src/lib/whatsapp/instancia.test.ts`

Isto **não existe no Coliseu** (lá o nome vinha do env, instância única). É o que
permite várias instâncias por empresa sem colidir numa Evolution compartilhada.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { slugificar, nomeTecnico, validarNomeInstancia } from "@/lib/whatsapp/instancia";

describe("nome técnico da instância", () => {
  it("slugifica o nome amigável", () => {
    expect(slugificar("Comercial")).toBe("comercial");
    expect(slugificar("Suporte Técnico")).toBe("suporte-tecnico");
    expect(slugificar("  Vendas 2  ")).toBe("vendas-2");
    expect(slugificar("Pós-venda / SAC")).toBe("pos-venda-sac");
  });

  it("compõe empresa + instância", () => {
    expect(nomeTecnico("tenka", "Comercial")).toBe("tenka-comercial");
  });

  it("não colide entre empresas com o mesmo nome de instância", () => {
    expect(nomeTecnico("tenka", "Comercial")).not.toBe(nomeTecnico("outra", "Comercial"));
  });

  it("recusa nome que vira slug vazio", () => {
    expect(() => nomeTecnico("tenka", "###")).toThrow();
  });

  it("aceita só o alfabeto da Evolution", () => {
    expect(validarNomeInstancia("tenka-comercial")).toBe("tenka-comercial");
    expect(() => validarNomeInstancia("tenka comercial")).toThrow();
    expect(() => validarNomeInstancia("../etc/passwd")).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/whatsapp/instancia.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/whatsapp/instancia.test.ts
```

Esperado: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/instancia.ts src/lib/whatsapp/instancia.test.ts
git commit -m "feat: nome tecnico de instancia prefixado pela empresa"
```

---

## Task 3: Client da Evolution

**Files:**
- Create: `src/lib/whatsapp/evolution.ts`

Portar de `coliseu-backend/src/lib/whatsapp/evolution.ts`. **Três mudanças:**

1. `configEvolution()` **não** lê `EVOLUTION_INSTANCE` — o nome da instância vira
   parâmetro de cada função, porque agora há várias. O `ConfigEvolution` fica
   `{ url, apiKey, webhookUrl, webhookSecret }`.
2. `validarNomeInstancia` passa a vir de `@/lib/whatsapp/instancia` (Task 2).
3. Mantém o comentário de cabeçalho dizendo que **este é o único módulo que envia** —
   é o que o teste de arquitetura da Task 8 protege.

Sem teste unitário: é I/O puro contra um serviço externo. É exercido de ponta a ponta
na Task 10.

- [ ] **Step 1: Portar o arquivo com as três mudanças acima**
- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/evolution.ts
git commit -m "feat: client da Evolution API multi-instancia"
```

---

## Task 4: Repositório de instâncias

**Files:**
- Create: `src/lib/repositories/instancias.ts`
- Test: `src/lib/repositories/instancias.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Cobrir, com `limparBanco`/`criarOrgTeste` de `@/lib/test/db`:

- criar instância grava `evolutionInstance = ${org.slug}-${slug(nome)}`;
- listar devolve só as da própria empresa;
- `instanciaDaOrgRepo(orgB, idDaA)` → `null`;
- `removerInstanciaRepo(orgB, idDaA)` → `false` e a linha da A continua lá;
- duas empresas podem criar instância com o **mesmo nome amigável** sem colidir;
- a mesma empresa **não** pode repetir o nome amigável (`@@unique([orgId, nome])`);
- `porNomeTecnicoRepo("tenka-comercial")` devolve a instância **com o `orgId`** —
  é o caminho que o webhook usa para descobrir a empresa;
- `atualizarStatusPorNomeTecnicoRepo` de uma instância não mexe no status das outras.

- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**

Assinaturas (todas com `orgId` primeiro, exceto as duas do webhook, que resolvem a
empresa **a partir** do nome técnico):

```ts
listarInstanciasRepo(orgId: string)
criarInstanciaRepo(orgId: string, orgSlug: string, nome: string)
instanciaDaOrgRepo(orgId: string, id: string)
removerInstanciaRepo(orgId: string, id: string): Promise<string | null>  // devolve o nome técnico removido
// caminho do webhook — a empresa vem daqui, nunca do payload:
porNomeTecnicoRepo(evolutionInstance: string)
atualizarStatusPorNomeTecnicoRepo(evolutionInstance, status, numeroConectado?, ultimoErro?)
```

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit**

---

## Task 5: Repositório de conversas e leads

**Files:**
- Create: `src/lib/repositories/conversas.ts`
- Test: `src/lib/repositories/conversas.test.ts`

Portar a metade "conversa/mensagem/classificação" de
`coliseu-backend/src/lib/repositories/whatsapp.ts`. **Mudanças:**

1. `Person` → `Lead`. Sem `codigo` sequencial, sem `fase`. O lead nasce com
   `origem: "whatsapp"`, `estagio: "novo"`.
2. A busca por telefone filtra **por `orgId` e por `ultimos8` indexado** — o Coliseu
   varre a tabela inteira em memória, o que não escala e vazaria entre empresas:

```ts
async function acharLeadPorTelefone(orgId: string, telefone: string): Promise<string | null> {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  const achado = await prisma.lead.findFirst({
    where: { orgId, ultimos8: chave },
    select: { id: true },
    orderBy: { criadoEm: "asc" },
  });
  return achado?.id ?? null;
}
```

3. `garantirConversaRepo` recebe `{ orgId, instanciaId, remoteJid, pushName }` e grava
   `ultimos8` ao criar o lead.
4. O mapa interesse → estágio vira uma constante local (o Coliseu importa de
   `@/lib/types`):

```ts
export const INTERESSE_ESTAGIO = {
  nao_classificado: "novo",
  com_interesse: "interesse",
  sem_interesse: "qualificado",
  perdido: "perdido",
  convertido: "convertido",
} as const;
```

5. `classificarConversaRepo` recebe `orgId` e escreve `orgId` no `AtendimentoRegistro`.
6. **Novo:** `listarConversasRepo` inclui o último registro de atendimento —
   `atendimentos: { take: 1, orderBy: { criadoEm: "desc" }, include: { user: { select: { nome: true } } } }` —
   e o resumo ganha `ultimoRegistro: { usuario, interesse, observacao, criadoEm } | null`.

Testes obrigatórios:

- ingestão cria conversa + lead + mensagem e conta não lidas;
- segunda entrega do mesmo `waMessageId` não duplica (`registrarMensagemRepo` → `false`);
- telefone já cadastrado (com DDI, sem 9º dígito, formatado) vincula em vez de duplicar;
- lead de **outra empresa** com o mesmo número **não** é vinculado — cria lead novo;
- `fromMe` entra como OUT sem `autorUserId` e zera não lidas;
- duas instâncias da mesma empresa mantêm conversas separadas para o mesmo número;
- classificar grava `AtendimentoRegistro`, move `Lead.estagio` e `perdido` guarda motivo;
- `listarConversasRepo` devolve o último registro e só conversas da própria empresa.

- [ ] **Step 1: Escrever os testes**
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit**

---

## Task 6: Ingestão

**Files:**
- Create: `src/lib/whatsapp/ingest.ts`

Portar de `coliseu-backend/src/lib/whatsapp/ingest.ts`. **Mudança central:** o Coliseu
chama `instanciaAtualRepo()` (instância única). Aqui a instância — e com ela a
empresa — vem do próprio evento:

```ts
const instancia = evento.instance ? await porNomeTecnicoRepo(evento.instance) : null;
if (!instancia) return { tipo: "ignorado", motivo: "instância desconhecida" };
// instancia.orgId é a fonte da empresa. O payload nunca informa empresa.
```

Manter intacto o comentário-invariante do topo (o módulo **não** importa
`@/lib/whatsapp/evolution`) e a lógica de `connection.update`: só `close` derruba;
`connecting` é estado de passagem e não pode marcar a instância como caída.

- [ ] **Step 1: Portar com a mudança acima**
- [ ] **Step 2: Verificar** — `npx tsc --noEmit`
- [ ] **Step 3: Commit**

---

## Task 7: Webhook

**Files:**
- Create: `src/app/api/webhooks/whatsapp/route.ts`

Portar de `coliseu-backend/src/app/api/webhooks/whatsapp/route.ts`. Comportamento:
confere `x-webhook-secret` (produção sem secret → 503), responde 200 na hora,
processa em seguida, e erro de processamento é logado sem virar retry infinito.

- [ ] **Step 1: Portar**
- [ ] **Step 2: Verificar** — `npx tsc --noEmit`
- [ ] **Step 3: Commit**

---

## Task 8: Teste de arquitetura "sem automação"

**Files:**
- Test: `src/lib/whatsapp/sem-automacao.test.ts`

Portar de `coliseu-backend/src/lib/whatsapp/sem-automacao.test.ts`, ajustando os
caminhos de entrada para `src/app/api/webhooks/whatsapp/route.ts` e
`src/lib/whatsapp/ingest.ts`, e o controle negativo para
`src/app/api/conversas/[id]/mensagens/route.ts`.

O teste percorre o fecho transitivo dos imports a partir do webhook e falha se
alcançar `lib/whatsapp/evolution`. O controle negativo garante que o teste não
passa por engano: a rota de resposta manual **deve** alcançar aquele módulo.

- [ ] **Step 1: Portar o teste**
- [ ] **Step 2: Rodar — deve passar já** (a rota da Task 9 ainda não existe; escreva
      o controle negativo só depois dela, ou marque `it.todo` e ative na Task 9)
- [ ] **Step 3: Commit**

---

## Task 9: Rotas de API

**Files:**
- Create: `src/app/api/instancias/route.ts`, `src/app/api/instancias/[id]/route.ts`,
  `src/app/api/instancias/[id]/qrcode/route.ts`
- Create: `src/app/api/conversas/route.ts`, `src/app/api/conversas/[id]/route.ts`,
  `src/app/api/conversas/[id]/mensagens/route.ts`

Regras que valem para todas:

- `orgId` sempre de `exigirSessaoApi().user.orgId`; nunca do corpo ou da query.
- Recurso de outra empresa → **404**.
- Criar/remover instância: `exigirAdminApi`. Ler/responder/classificar: `exigirSessaoApi`.
- Sem `configEvolution()` → **503** com mensagem legível, sem quebrar a página.

`POST /api/conversas/[id]/mensagens` valida que a instância da conversa está
`CONNECTED`, envia por `enviarTexto`, grava OUT com o `key.id` e `autorUserId` da
sessão, e assume `atendenteId` se estiver vazio. Falha de envio grava a mensagem com
`erro` preenchido e devolve 502 — a bolha aparece como não entregue em vez de o texto
sumir.

`GET /api/instancias` faz a **reconciliação**: consulta `estadoConexao` de todas as
instâncias da empresa em paralelo (`Promise.allSettled`), tolerante a falha, e corrige
as divergentes antes de responder.

- [ ] **Step 1: Escrever as rotas de instância**
- [ ] **Step 2: Escrever as rotas de conversa**
- [ ] **Step 3: Ativar o controle negativo do teste da Task 8**
- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npm test`
- [ ] **Step 5: Commit**

---

## Task 10: Tela de instâncias

**Files:**
- Create: `src/app/(app)/instancias/page.tsx`, `src/components/instancias/InstanciasView.tsx`,
  `src/components/instancias/ModalQrCode.tsx`

Portar a lógica de pareamento de `coliseu-backend/src/components/captacao/ConectarWhatsapp.tsx`,
mas em lista: um card por instância com nome, chip de status, número conectado e
`ultimoErro` quando houver.

Modal de QR: refaz o QR a cada 20s, checa `connectionState` a cada 3s, e ao ver `open`
fecha e dá `router.refresh()`. GSAP: abertura em escala, crossfade ao trocar o QR
expirado, pulso no chip ao virar `CONNECTED` — tudo dentro de
`gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.

- [ ] **Step 1: Página + view**
- [ ] **Step 2: Modal de QR**
- [ ] **Step 3: Verificação manual** — criar instância, ler o QR, parear com um celular,
      ver o card virar `CONNECTED` sozinho
- [ ] **Step 4: Commit**

---

## Task 11: Inbox

**Files:**
- Create: `src/app/(app)/inbox/page.tsx`, `src/components/inbox/InboxView.tsx`,
  `src/components/inbox/ConversaPainel.tsx`

Portar de `AtendimentoInbox.tsx` e `ConversaPainel.tsx`. **Acréscimos:**

- filtro por instância no topo da lista (o Coliseu só tem um número);
- badge da instância em cada linha, quando houver mais de uma;
- bloco do **último registro** no topo do painel (atendente, quando, classificação,
  observação) e o histórico completo num expandir;
- composer desabilitado com aviso quando a conversa não tem telefone (`@lid`).

Polling: lista a cada 5s, thread aberta a cada 3s com `?depois=<iso>`.
GSAP: entrada escalonada da lista, bolha nova em fade + deslocamento, contador de
não lidas animado.

- [ ] **Step 1: Página + lista**
- [ ] **Step 2: Painel da conversa com composer e classificação**
- [ ] **Step 3: Verificação manual** — mandar mensagem de um celular, ver o lead
      nascer, responder pela tela, classificar, conferir o registro
- [ ] **Step 4: Commit**

---

## Task 12: Navegação e fechamento

**Files:**
- Modify: `src/lib/auth/papeis.ts`, `src/components/Sidebar.tsx`, `README.md`

- [ ] **Step 1: `rotaInicial` passa a devolver `/inbox` para os dois papéis**

Ajustar `src/lib/auth/papeis.test.ts` junto — hoje espera `/equipe` e `/perfil`.

- [ ] **Step 2: Sidebar ganha Inbox e Instâncias**

Inbox: ADMIN + ATENDENTE. Instâncias: só ADMIN.

- [ ] **Step 3: Suíte inteira e build**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 4: Atualizar o README (estado: Fase 2 concluída) e commit**

---

## Critério de pronto da Fase 2

- [ ] `npm test` verde, incluindo o teste de arquitetura "sem automação" com controle negativo.
- [ ] Duas instâncias pareadas na mesma empresa, cada uma com suas conversas.
- [ ] Mensagem de número novo cria lead automaticamente e aparece no inbox.
- [ ] Resposta manual chega no celular; reentrega do webhook não duplica a bolha.
- [ ] Classificar move o estágio do lead e grava o registro com autor e data.
- [ ] Derrubar a Evolution e voltar: o card reconcilia o status sozinho ao recarregar.
- [ ] Nenhuma resposta automática em nenhum cenário.
