# Tenka Call — central de atendimento WhatsApp — design

Data: 2026-07-23
Status: aprovado pelo usuário
Repositório: https://github.com/freelandoo/tenka-call.git

## Objetivo

Uma empresa conecta um ou mais números de WhatsApp ao Tenka Call. A partir daí
toda conversa recebida vira **lead registrado** e **histórico persistido**. A
equipe lê o histórico, responde manualmente pela própria tela, classifica o
interesse e deixa registrado quem atendeu e o que ficou combinado.

**Não há resposta automática.** Nenhum caminho do código responde ao lead sem um
clique humano. O webhook apenas grava.

Origem: o módulo de Captação/Atendimento do Coliseu
(`C:\Users\Alex\Documents\Antigravity\Coliseu\coliseu-backend`) já resolve esse
problema em produção. Este projeto porta aquele módulo para um produto
independente e multiempresa, com múltiplas instâncias por empresa.

## Escopo

Dentro do v1:

- Cadastro de empresas (`Org`) com isolamento total de dados.
- Usuários por empresa, com papéis ADMIN e ATENDENTE.
- Criar/conectar/desconectar/remover **várias** instâncias de WhatsApp por empresa,
  com detecção automática do estado da conexão.
- Ingestão de mensagens recebidas e das enviadas pelo celular, em histórico persistido.
- Criação/vinculação automática de `Lead` por conversa.
- Inbox multi-número: lista de conversas → histórico → responder texto.
- Classificação de interesse e registro de atendimento append-only, com o
  **último registro** visível na lista e no painel.

Fora do v1, documentado como não-objetivo:

- Qualquer automação, IA, resposta automática, fila de disparo ou campanha.
- Envio e download de mídia. Mensagem de mídia recebida entra no histórico como
  marcador (`📷 Imagem`, `🎤 Áudio`), sem baixar o binário.
- Grupos, listas de transmissão e status.
- Aba de funil de leads com filtros e relatórios. A ficha do lead existe, mas
  dentro do painel da conversa.
- Troca de empresa na UI. O schema isola por empresa desde já; a UI do v1 opera
  a empresa da sessão.

## Arquitetura

Quatro serviços no Railway:

```
┌──────────────┐  HTTP interno  ┌───────────────┐   Baileys    ┌──────────┐
│  tenka-call  │───────────────▶│ evolution-api │ ◀──────────▶ │ WhatsApp │
│  (Next.js)   │                │    v2.3.7     │              └──────────┘
└──────────────┘                └───────────────┘
      ▲                             │       │
      │ webhook HTTPS público       │       │ cache de sessão
      └─────────────────────────────┘       ▼
                                     ┌───────────────┐
   ambos ──▶ Postgres                │     redis     │
   (schemas separados)               └───────────────┘
```

- **tenka-call**: Next.js 16 App Router, React 19, TypeScript, Prisma, Tailwind 4,
  GSAP, vitest. Um serviço só — as rotas de API e o webhook são route handlers.
- **evolution-api**: imagem `evoapicloud/evolution-api:v2.3.7`, volume em
  `/evolution/instances`. **Nunca exposta publicamente** — só rede interna Railway.
- **redis**: cache de sessão do Baileys (`CACHE_REDIS_ENABLED=true`). É o que
  segura reconexão estável sem repareamento. **O Next não usa Redis** — sem fila,
  sem client novo no app. A ingestão é síncrona e idempotente.
- **Postgres**: a Evolution usa o mesmo banco em `?schema=evolution`; o Prisma do
  Tenka Call fica em `?schema=public`. Não colidem, e evita um serviço extra.

Direções de tráfego:

- Tenka Call → Evolution: `http://evolution-api.railway.internal:8080`, header `apikey`.
- Evolution → Tenka Call: `POST https://<app>/api/webhooks/whatsapp`, header
  `x-webhook-secret`. Eventos assinados: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`,
  `QRCODE_UPDATED`.

## Multiempresa

Toda tabela de negócio carrega `orgId`. As regras que sustentam o isolamento:

1. **A sessão é a fonte da empresa.** O cookie de sessão resolve `userId` e
   `orgId`; nenhum handler aceita `orgId` vindo do corpo, da query ou de header.
2. **Todo repositório recebe `orgId` como primeiro argumento** e o inclui no
   `where`. Não existe função de leitura sem escopo.
3. **O webhook resolve a empresa pela instância.** O payload da Evolution traz
   `instance` (nome técnico); o handler busca `Instancia.evolutionInstance` e usa
   o `orgId` daquela linha. O payload nunca informa a empresa.
4. **Nome técnico da instância é global-único**: `${org.slug}-${slug(nome)}`.
   Uma Evolution compartilhada entre empresas não colide, e o nome já denuncia
   a quem pertence.
5. **Teste cross-tenant obrigatório**: para cada rota de leitura e escrita, um
   teste tenta acessar recurso de outra empresa e espera 404.

O v1 cria uma empresa por seed/script administrativo. Não há tela de signup.

## Dados (Prisma, schema `public`)

```prisma
enum Role              { ADMIN ATENDENTE }
enum WhatsappStatus    { DISCONNECTED CONNECTING CONNECTED }
enum ConversaInteresse { nao_classificado com_interesse sem_interesse perdido convertido }
enum LeadEstagio       { novo interesse qualificado perdido convertido }
enum MensagemDirecao   { IN OUT }
enum MensagemAutor     { LEAD ATENDENTE }

Org        id, slug @unique, nome, criadoEm

User       id, orgId, login @unique, email? @unique, nome, passwordHash,
           role @default(ATENDENTE), ativo @default(true),
           senhaProvisoria @default(false), criadoEm

Session    id, userId, expiraEm, criadoEm

Instancia  id, orgId, evolutionInstance @unique, nome, status @default(DISCONNECTED),
           numeroConectado?, ultimoEstadoEm?, ultimoErro?, criadoEm
           @@unique([orgId, nome])
           @@index([orgId, status])

Lead       id, orgId, nome, telefone, ultimos8, origem, estagio @default(novo),
           motivoPerdido?, observacao?, criadoEm
           @@index([orgId, ultimos8])
           @@index([orgId, estagio])

Conversa   id, orgId, instanciaId, remoteJid, telefone, pushName?,
           leadId?, atendenteId?, interesse @default(nao_classificado),
           naoLidas @default(0), ultimaMensagemEm, ultimaMensagemPreview, criadoEm
           @@unique([instanciaId, remoteJid])
           @@index([orgId, ultimaMensagemEm])
           @@index([leadId])

Mensagem   id, conversaId, waMessageId @unique, direcao, autor, autorUserId?,
           texto, tipoMidia @default("texto"), enviadaEm, erro?
           @@index([conversaId, enviadaEm])

AtendimentoRegistro  id, orgId, conversaId, userId, interesse, observacao?, criadoEm
                     @@index([conversaId, criadoEm])
```

`waMessageId @unique` é o que torna reentrega da Evolution um no-op: a colisão
`P2002` é tratada como sucesso.

`AtendimentoRegistro` é o cadastro de atendimento — log append-only de quem
classificou o quê e quando. `Conversa.interesse` é só o estado corrente,
desnormalizado para a lista não precisar de subquery.

`Lead.ultimos8` são os últimos 8 dígitos do telefone, gravados na escrita. É uma
coluna indexada em vez de expressão calculada em query para o match não varrer
a tabela.

`Instancia.ultimoErro` guarda a última falha de conexão em texto curto, para a
tela mostrar por que caiu sem obrigar o operador a ler log.

`User.login` é único **globalmente**, não por empresa. É o que permite a tela de
login pedir só login e senha: o usuário identifica a empresa, não o contrário.
O custo é que dois clientes não podem ter o mesmo login — aceito, e o admin
recebe erro claro ("login já em uso") ao criar. `Lead.origem` é texto livre
(`"whatsapp"` no v1), não enum: novas origens não devem exigir migration.

### Lead: criar ou vincular

Mensagem de número desconhecido → procura `Lead` na **mesma empresa** por
`ultimos8`. Comparar os últimos 8 dígitos absorve o 9º dígito e o DDI, que o
WhatsApp entrega de forma inconsistente.

- Achou → vincula `Conversa.leadId`, não duplica cadastro.
- Não achou → cria `Lead` com `origem="whatsapp"`, `estagio=novo`,
  `nome = pushName ?? telefone formatado`, `telefone`, `ultimos8`.

Todo mundo que manda mensagem entra como lead no mesmo instante em que a conversa
aparece no inbox.

### Interesse → estágio do lead

O select do atendimento escreve nos dois campos. Mapa fixo:

| Select           | `Conversa.interesse` | `Lead.estagio`              |
| ---------------- | -------------------- | --------------------------- |
| Não classificado | `nao_classificado`   | (não mexe)                  |
| Com interesse    | `com_interesse`      | `interesse`                 |
| Sem interesse    | `sem_interesse`      | `qualificado`               |
| Perdido          | `perdido`            | `perdido` + `motivoPerdido` |
| Convertido       | `convertido`         | `convertido`                |

"Sem interesse" cai em `qualificado` de propósito: a pessoa conversou e foi
qualificada, mas não quer agora — é a lista de reativação. `perdido` é o descarte
definitivo, com motivo obrigatório.

## Fluxos

### Criar e conectar instância

1. ADMIN abre `/instancias`, clica **Nova instância**, dá um nome amigável
   ("Comercial", "Suporte").
2. `POST /api/instancias { nome }` → deriva `evolutionInstance = ${org.slug}-${slug(nome)}`,
   chama `instance/create` na Evolution (`integration: WHATSAPP-BAILEYS`,
   `qrcode: true`, webhook já no payload), grava `Instancia` com `CONNECTING`.
   Se a instância já existe na Evolution (403/409 ou mensagem "already in use"),
   reaproveita e só reaplica o webhook — a operação é idempotente.
3. Modal chama `GET /api/instancias/[id]/qrcode` → `instance/connect`, devolve
   `{ base64, pairingCode }` ou `{ conectado: true }`.
4. Modal refaz o QR a cada 20s e checa `connectionState` a cada 3s. Ao ver
   `open`, grava `CONNECTED` + número, fecha e atualiza a lista.

Falha da Evolution (rede/502) devolve 502 com mensagem legível; o modal mostra e
oferece "Tentar de novo". Nada fica meio-criado: a linha só vira `CONNECTED`
quando o `connectionState` confirma.

### Detecção automática de conexão

Duas vias que se corrigem, sem cron e sem worker:

1. **Webhook `CONNECTION_UPDATE`** — caminho normal. A Evolution avisa mudança de
   estado; o handler resolve a instância pelo nome técnico e escreve `status`,
   `numeroConectado`, `ultimoEstadoEm` e, em queda, `ultimoErro`.
2. **Reconciliação na leitura** — ao carregar `/instancias`, o servidor consulta
   `connectionState` de todas as instâncias da empresa em paralelo, com timeout
   curto e tolerante a falha (indisponibilidade vira "desconhecido", nunca erro
   de página), e corrige as que divergirem do banco. Cobre webhook perdido,
   instância criada fora do app e Evolution reiniciada.

A renderização inicial da página lê só o banco — a página não espera rede
externa. A reconciliação acontece logo depois, do componente cliente.

### Receber

`POST /api/webhooks/whatsapp`:

1. Confere `x-webhook-secret`. Em produção sem secret configurado → 503.
2. Responde `200` imediatamente; processa em seguida. Erro no processamento é
   logado, nunca vira retry infinito da Evolution.
3. Resolve a empresa por `payload.instance` → `Instancia`. Instância
   desconhecida → log e 200 (não é erro do remetente).
4. `connection.update` → atualiza status da instância e termina.
   `messages.upsert` → segue. Qualquer outro evento é ignorado.
5. Descarta `@g.us`, `@broadcast`, `status@broadcast`.
6. Extrai texto (`conversation`, `extendedTextMessage.text`, `*.caption`) e
   `tipoMidia`. Sem texto e sem mídia → ignora.
7. Upsert de `Conversa` por `instanciaId + remoteJid`; resolve ou cria `Lead`.
8. Grava `Mensagem`. `waMessageId @unique` deduplica reentrega (`P2002` → no-op).
9. `fromMe: true` → grava `OUT` / `ATENDENTE` sem `autorUserId` (respondido pelo
   aparelho, aparece no histórico como "pelo aparelho") e zera não-lidas.
   `fromMe: false` → `IN` / `LEAD` e incrementa `naoLidas`.

**Nenhum ramo deste fluxo envia mensagem.** Há teste garantindo isso.

### Responder

`POST /api/conversas/[id]/mensagens { texto }` (ADMIN ou ATENDENTE, mesma
empresa): valida que a instância da conversa está `CONNECTED` → `message/sendText`
→ grava `Mensagem` OUT com o `key.id` retornado e `autorUserId` do usuário da
sessão. Se a conversa ainda não tem `atendenteId`, assume o usuário atual.
Quando o mesmo id voltar pelo webhook (`fromMe`), o `@unique` deduplica.

Falha de envio grava a mensagem com `erro` preenchido e devolve 502 — a equipe vê
a bolha marcada como não entregue em vez de perder o texto.

### Classificar e registrar

`PATCH /api/conversas/[id] { interesse, observacao?, motivoPerdido? }`: atualiza
`Conversa.interesse`, aplica o mapa em `Lead.estagio` e insere
`AtendimentoRegistro` com o usuário da sessão. As três escritas em uma transação.

O **último registro** (atendente, data, classificação, observação) é lido com
`atendimentos: { take: 1, orderBy: { criadoEm: "desc" } }` e aparece como linha
resumo na lista de conversas e como bloco no topo do painel. O histórico completo
de registros abre em um expandir.

## UI

Rotas:

- `/login`
- `/inbox` — lista de conversas à esquerda, painel à direita (`?c=<conversaId>`).
  Filtros: instância, interesse, apenas não lidas, busca por nome/telefone.
- `/instancias` — cards por instância com status ao vivo, número conectado,
  criar, gerar QR, desconectar, remover. ADMIN.
- `/equipe` — usuários da empresa, criar/desativar, resetar senha. ADMIN.

Painel da conversa: cabeçalho com nome, telefone, instância que recebeu e chip do
estágio do lead; ficha do lead editável (nome, observação) em painel lateral;
histórico em bolhas (IN à esquerda, OUT à direita, marcador de mídia e de erro);
rodapé com composer de texto, `select` de interesse e campo de observação.

Realtime por polling — sem SSE, sem WebSocket: lista a cada 5s, thread aberta a
cada 3s (`?depois=<isoDate>`, devolve só o delta). Suficiente para uma equipe de
atendimento e não adiciona infra.

### Movimento (GSAP)

`gsap` + `@gsap/react`, sempre via `useGSAP` com escopo em ref — nunca seletor
global. Onde entra:

- Lista de conversas: entrada escalonada no primeiro render; conversa que sobe
  para o topo por mensagem nova anima a troca de posição (FLIP simples).
- Bolhas novas: fade + deslocamento curto na chegada pelo polling.
- Modal de QR: abertura em escala, e troca do QR expirado em crossfade.
- Instância mudando de status: pulso no chip ao ir para `CONNECTED`.
- Contador de não-lidas: contagem animada na mudança.

Tudo atrás de `prefers-reduced-motion`: com a preferência ativa, os elementos
aparecem no estado final sem animação. Nenhuma animação bloqueia interação nem
atrasa a leitura da mensagem.

## Segurança

- `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SECRET` e `DATABASE_URL` só no servidor;
  nunca em props de client component nem em `NEXT_PUBLIC_*`.
- Senhas com Argon2id (`@node-rs/argon2`). Sessão **opaca no banco**: o cookie
  `httpOnly` / `secure` / `sameSite=lax` guarda só o id da linha `Session`, e a
  cada requisição o servidor relê a sessão e o usuário. Não há JWT: desativar um
  atendente derruba o acesso na hora, sem esperar token expirar, e não existe
  segredo de assinatura para vazar ou rotacionar.
- Criar/remover instância e gerir equipe: ADMIN. Ler/responder/classificar:
  ADMIN + ATENDENTE.
- Evolution sem porta pública no Railway.
- Log de telefone sempre redigido (últimos 4 dígitos).
- Recurso de outra empresa responde 404, não 403 — não confirma existência.

## Testes (vitest)

Unitários, puros, sem rede:

- `payload.test.ts` — extração de texto e `tipoMidia` dos formatos Baileys
  (conversation, extendedText, imageMessage+caption, audioMessage, botão, vazio,
  `remoteJidAlt` sobre `@lid`); filtro de grupo/broadcast/status.
- `telefone.test.ts` — normalização, `ultimos8`, match com e sem 9º dígito e DDI,
  formatação para exibição, redação em log.
- `instancia.test.ts` — derivação e validação do nome técnico
  (`${slug}-${slug}`, alfabeto aceito pela Evolution, colisão entre empresas).

Integração (Postgres de dev):

- ingestão cria conversa + `Lead` + mensagem e conta não lidas;
- segunda entrega do mesmo `waMessageId` não duplica;
- número já cadastrado (inclusive formatado, sem DDI) vincula em vez de duplicar;
- `fromMe` entra como saída sem autor de sistema e zera não lidas;
- grupo ignorado; evento de instância desconhecida não quebra;
- duas instâncias da mesma empresa mantêm conversas separadas para o mesmo número;
- classificar grava `AtendimentoRegistro` e move o `estagio`; `perdido` guarda o motivo;
- `CONNECTION_UPDATE` de uma instância não afeta o status das outras.

Cross-tenant (`cross-tenant.test.ts`): para cada rota, empresa B tentando ler ou
escrever recurso da empresa A recebe 404.

Garantia de "sem automação" (`sem-automacao.test.ts`): teste de **arquitetura**,
não de comportamento. Percorre o fecho transitivo dos imports a partir da
ingestão e do webhook e falha se algum deles alcançar `@/lib/whatsapp/evolution`
— o único módulo que envia. Inclui controle negativo (a rota de resposta manual
*deve* alcançá-lo), para o teste não passar por engano.

## Variáveis de ambiente

```
DATABASE_URL=postgresql://…?schema=public
EVOLUTION_URL=http://evolution-api.railway.internal:8080
EVOLUTION_API_KEY=                           # mesma chave do serviço evolution-api
WHATSAPP_WEBHOOK_SECRET=                     # header x-webhook-secret
PUBLIC_APP_URL=https://tenka-call-production.up.railway.app
```

Sem `EVOLUTION_URL`/`EVOLUTION_API_KEY` o app roda normalmente: `/instancias`
mostra "WhatsApp não configurado" e as rotas devolvem 503, sem quebrar nada.

No serviço evolution-api:

```
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://…?schema=evolution
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://…
AUTHENTICATION_API_KEY=                      # = EVOLUTION_API_KEY do app
```

## Riscos

- **Ban de número**: envio manual, volume baixo, sem disparo em massa. Risco
  aceito; documentado no DEPLOY.md que o número deve ser da empresa, não pessoal.
- **Sessão perdida**: se o volume `/evolution/instances` sumir, é repareamento
  por QR de cada instância. Aceito; o Redis reduz a frequência.
- **`@lid`**: o WhatsApp pode entregar JID sem telefone. Nesse caso a conversa é
  gravada com `remoteJid` original e telefone vazio; o lead é criado sem telefone
  e a equipe completa na ficha. Não bloqueia a ingestão, e a conversa não pode
  receber resposta até ter número (o composer fica desabilitado com aviso).
- **Evolution compartilhada**: uma Evolution serve todas as empresas. Se ela cair,
  todas param. Aceito no v1; a separação por serviço fica para quando houver
  volume que justifique.
