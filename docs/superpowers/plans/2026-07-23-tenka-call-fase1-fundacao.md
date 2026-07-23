# Tenka Call — Fase 1: fundação (projeto, banco, auth, equipe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Tenka Call de pé com banco, autenticação por sessão opaca, isolamento por empresa provado em teste e a tela de equipe funcionando — pronto para receber o módulo de WhatsApp na Fase 2.

**Architecture:** Next.js 16 App Router como serviço único. Prisma sobre Postgres com `orgId` em toda tabela de negócio; nenhuma função de repositório lê sem escopo de empresa. Sessão é uma linha no banco cujo id vive num cookie `httpOnly` — sem JWT, então desativar um atendente derruba o acesso na hora. Papéis ADMIN e ATENDENTE resolvidos por um mapa puro e testável.

**Tech Stack:** Next.js 16.2.9 · React 19.2.4 · TypeScript 5 · Prisma 6 · PostgreSQL 16 · Tailwind CSS 4 · GSAP 3 (`@gsap/react`) · `@node-rs/argon2` · vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md`

**Fora desta fase (é a Fase 2):** client da Evolution, instâncias, QR, webhook, ingestão, leads, inbox, classificação, registro de atendimento. O schema Prisma desta fase **já cria** essas tabelas, porque uma migration só é mais barata que duas e o `docker-compose` já sobe a Evolution para a fase seguinte.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `prisma/schema.prisma` | Modelo de dados completo do produto |
| `prisma/seed.ts` | Cria a primeira empresa e o primeiro ADMIN |
| `src/lib/db.ts` | Instância única do PrismaClient |
| `src/lib/auth/password.ts` | Hash e verificação Argon2id |
| `src/lib/auth/papeis.ts` | Mapa puro de papel → permissão e rota inicial |
| `src/lib/auth/session.ts` | Criar, ler e destruir a sessão (cookie + banco) |
| `src/lib/auth/guards.ts` | Guards de página (redirect) e de rota `/api` (401/403) |
| `src/lib/repositories/usuarios.ts` | Toda leitura/escrita de `User`, sempre com `orgId` |
| `src/lib/test/db.ts` | Fixtures e limpeza do banco de teste |
| `src/components/ui/Reveal.tsx` | Entrada GSAP reutilizável, respeita reduced-motion |
| `src/components/ui/primitives.tsx` | Botão, Campo, Card — base visual compartilhada |
| `src/components/Sidebar.tsx` | Navegação do app autenticado |
| `src/components/equipe/EquipeView.tsx` | Tela de equipe (client) |
| `src/components/perfil/AlterarSenha.tsx` | Troca de senha (client) |
| `src/app/login/page.tsx` | Tela de login |
| `src/app/(app)/layout.tsx` | Casca autenticada (sidebar + guard) |
| `src/app/(app)/equipe/page.tsx` | Página de equipe (ADMIN) |
| `src/app/(app)/perfil/page.tsx` | Página de perfil |
| `src/app/api/auth/login/route.ts` | POST login |
| `src/app/api/auth/logout/route.ts` | POST logout |
| `src/app/api/usuarios/route.ts` | GET lista, POST cria |
| `src/app/api/usuarios/[id]/route.ts` | PATCH ativo/senha |
| `src/app/api/perfil/senha/route.ts` | POST troca a própria senha |
| `Dockerfile`, `railway.json`, `docker-compose.yml` | Build e infra |

---

## Task 1: Esqueleto do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "tenka-call",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@gsap/react": "^2.1.2",
    "@node-rs/argon2": "^2.0.2",
    "@prisma/client": "^6.19.3",
    "gsap": "^3.15.0",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv": "^17.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "prisma": "^6.19.3",
    "tailwindcss": "^4",
    "tsx": "^4.23.0",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Criar os configs de build**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

`vitest.config.ts` — `dotenv/config` carrega o `.env` para os testes de
integração acharem `DATABASE_URL`; `fileParallelism: false` porque os testes
compartilham um Postgres só e limpam tabelas entre si:

```ts
import "dotenv/config";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Criar o layout raiz e o CSS global**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-fundo: #0b0d10;
  --color-superficie: #14181d;
  --color-borda: #232a32;
  --color-texto: #e7ecf1;
  --color-fraco: #93a1b0;
  --color-acento: #22d3ee;
}

html,
body {
  background: var(--color-fundo);
  color: var(--color-texto);
}

body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Rede de segurança: mesmo que uma animação escape do gsap.matchMedia,
   quem pediu menos movimento não recebe movimento. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenka Call",
  description: "Central de atendimento WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Instalar e verificar**

```bash
npm install
npx tsc --noEmit
```

Esperado: `npm install` conclui e `tsc` termina sem imprimir erro.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts src/app/layout.tsx src/app/globals.css
git commit -m "chore: esqueleto Next 16 + Tailwind 4 + vitest"
```

---

## Task 2: Banco de dados e infra local

**Files:**
- Create: `prisma/schema.prisma`, `docker-compose.yml`, `.env.example`, `.env`

- [ ] **Step 1: Criar `prisma/schema.prisma`**

Cria já todas as tabelas do produto (inclusive as da Fase 2): uma migration só,
e o teste de isolamento da Fase 1 pode limpar tudo sem precisar de migration nova.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  ATENDENTE
}

enum WhatsappStatus {
  DISCONNECTED
  CONNECTING
  CONNECTED
}

enum ConversaInteresse {
  nao_classificado
  com_interesse
  sem_interesse
  perdido
  convertido
}

enum LeadEstagio {
  novo
  interesse
  qualificado
  perdido
  convertido
}

enum MensagemDirecao {
  IN
  OUT
}

enum MensagemAutor {
  LEAD
  ATENDENTE
}

model Org {
  id       String   @id @default(cuid())
  slug     String   @unique
  nome     String
  criadoEm DateTime @default(now())

  users        User[]
  instancias   Instancia[]
  leads        Lead[]
  conversas    Conversa[]
  atendimentos AtendimentoRegistro[]
}

model User {
  id              String   @id @default(cuid())
  org             Org      @relation(fields: [orgId], references: [id])
  orgId           String
  /// Único globalmente: a tela de login pede só login e senha, e a empresa vem do usuário.
  login           String   @unique
  email           String?  @unique
  nome            String
  passwordHash    String
  role            Role     @default(ATENDENTE)
  /// Desativar em vez de apagar preserva a trilha de quem fez o quê.
  ativo           Boolean  @default(true)
  /// Senha definida pelo admin — força a troca no primeiro acesso.
  senhaProvisoria Boolean  @default(false)
  criadoEm        DateTime @default(now())

  sessions           Session[]
  conversasAtendidas Conversa[]
  mensagensEnviadas  Mensagem[]
  atendimentos       AtendimentoRegistro[]

  @@index([orgId, ativo])
}

model Session {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiraEm  DateTime
  criadoEm  DateTime @default(now())

  @@index([userId])
}

model Instancia {
  id                String         @id @default(cuid())
  org               Org            @relation(fields: [orgId], references: [id])
  orgId             String
  /// Nome técnico na Evolution: `${org.slug}-${slug(nome)}`.
  evolutionInstance String         @unique
  nome              String
  status            WhatsappStatus @default(DISCONNECTED)
  numeroConectado   String?
  ultimoEstadoEm    DateTime?
  ultimoErro        String?
  criadoEm          DateTime       @default(now())

  conversas Conversa[]

  @@unique([orgId, nome])
  @@index([orgId, status])
}

model Lead {
  id            String      @id @default(cuid())
  org           Org         @relation(fields: [orgId], references: [id])
  orgId         String
  nome          String
  telefone      String
  /// Últimos 8 dígitos do telefone — coluna indexada para o match não varrer a tabela.
  ultimos8      String
  origem        String      @default("whatsapp")
  estagio       LeadEstagio @default(novo)
  motivoPerdido String?
  observacao    String?
  criadoEm      DateTime    @default(now())

  conversas Conversa[]

  @@index([orgId, ultimos8])
  @@index([orgId, estagio])
}

model Conversa {
  id          String    @id @default(cuid())
  org         Org       @relation(fields: [orgId], references: [id])
  orgId       String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)
  instanciaId String
  remoteJid   String
  /// Só dígitos; vazio quando o JID não expõe o número (@lid).
  telefone    String
  pushName    String?

  lead        Lead?   @relation(fields: [leadId], references: [id], onDelete: SetNull)
  leadId      String?
  atendente   User?   @relation(fields: [atendenteId], references: [id], onDelete: SetNull)
  atendenteId String?

  interesse             ConversaInteresse @default(nao_classificado)
  naoLidas              Int               @default(0)
  ultimaMensagemEm      DateTime          @default(now())
  ultimaMensagemPreview String            @default("")
  criadoEm              DateTime          @default(now())

  mensagens    Mensagem[]
  atendimentos AtendimentoRegistro[]

  @@unique([instanciaId, remoteJid])
  @@index([orgId, ultimaMensagemEm])
  @@index([leadId])
}

model Mensagem {
  id          String          @id @default(cuid())
  conversa    Conversa        @relation(fields: [conversaId], references: [id], onDelete: Cascade)
  conversaId  String
  /// key.id do WhatsApp — dedupe de reentrega do webhook.
  waMessageId String          @unique
  direcao     MensagemDirecao
  autor       MensagemAutor
  autorUser   User?           @relation(fields: [autorUserId], references: [id], onDelete: SetNull)
  /// Nulo em OUT enviado pelo próprio aparelho.
  autorUserId String?
  texto       String
  tipoMidia   String          @default("texto")
  enviadaEm   DateTime        @default(now())
  erro        String?

  @@index([conversaId, enviadaEm])
}

/// Cadastro de atendimento: log append-only de quem classificou o quê.
model AtendimentoRegistro {
  id         String            @id @default(cuid())
  org        Org               @relation(fields: [orgId], references: [id])
  orgId      String
  conversa   Conversa          @relation(fields: [conversaId], references: [id], onDelete: Cascade)
  conversaId String
  user       User              @relation(fields: [userId], references: [id])
  userId     String
  interesse  ConversaInteresse
  observacao String?
  criadoEm   DateTime          @default(now())

  @@index([conversaId, criadoEm])
}
```

- [ ] **Step 2: Criar `docker-compose.yml`**

Sobe Postgres, Redis e Evolution já agora — a Fase 2 usa os dois últimos sem
mexer em infra. A Evolution fica em `?schema=evolution`, o app em `?schema=public`.

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tenka
      POSTGRES_PASSWORD: tenka
      POSTGRES_DB: tenka
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tenka"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  evolution:
    image: evoapicloud/evolution-api:v2.3.7
    depends_on:
      db:
        condition: service_healthy
    environment:
      AUTHENTICATION_API_KEY: dev-evolution-key
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://tenka:tenka@db:5432/tenka?schema=evolution
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: redis://redis:6379/0
      CACHE_REDIS_PREFIX_KEY: evolution
      CACHE_LOCAL_ENABLED: "false"
    ports:
      - "8080:8080"
    volumes:
      - evolutioninstances:/evolution/instances

volumes:
  pgdata:
  redisdata:
  evolutioninstances:
```

- [ ] **Step 3: Criar `.env.example` e `.env`**

`.env.example` (versionado):

```
DATABASE_URL=postgresql://tenka:tenka@localhost:5432/tenka?schema=public

# Seed da primeira empresa e do primeiro admin
SEED_ORG_SLUG=tenka
SEED_ORG_NOME=Tenka
SEED_ADMIN_LOGIN=admin
SEED_ADMIN_SENHA=

# Fase 2 — sem estes, o app sobe e as rotas de WhatsApp devolvem 503
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=dev-evolution-key
WHATSAPP_WEBHOOK_SECRET=
PUBLIC_APP_URL=http://localhost:3000
```

`.env` (ignorado pelo git) — copie o exemplo e defina `SEED_ADMIN_SENHA` com uma
senha real de desenvolvimento.

- [ ] **Step 4: Subir o banco e aplicar a migration**

```bash
docker compose up -d db redis
npx prisma migrate dev --name init
```

Esperado: cria `prisma/migrations/<timestamp>_init/` e imprime
`Your database is now in sync with your schema`, seguido de
`Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma docker-compose.yml .env.example
git commit -m "feat: schema Prisma completo e infra local (postgres, redis, evolution)"
```

---

## Task 3: Client do Prisma

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Criar `src/lib/db.ts`**

Instância única: em dev o hot reload recria módulos e abriria uma conexão nova a
cada recarga, esgotando o pool.

```ts
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  g.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Esperado: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: client unico do Prisma"
```

---

## Task 4: Senhas com Argon2id

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `src/lib/auth/password.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("verifica a senha correta", async () => {
    const hash = await hashPassword("senha-boa-123");
    expect(await verifyPassword(hash, "senha-boa-123")).toBe(true);
  });

  it("rejeita a senha errada", async () => {
    const hash = await hashPassword("senha-boa-123");
    expect(await verifyPassword(hash, "senha-ruim")).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt por hash)", async () => {
    const a = await hashPassword("igual");
    const b = await hashPassword("igual");
    expect(a).not.toBe(b);
  });

  it("devolve false em hash corrompido em vez de lançar", async () => {
    expect(await verifyPassword("nao-e-um-hash", "qualquer")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/auth/password.test.ts
```

Esperado: FAIL — `Failed to resolve import "@/lib/auth/password"`.

- [ ] **Step 3: Implementar**

`src/lib/auth/password.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Hash corrompido ou de outro algoritmo devolve false — nunca derruba o login. */
export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/auth/password.test.ts
```

Esperado: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/password.ts src/lib/auth/password.test.ts
git commit -m "feat: hash e verificacao de senha com argon2id"
```

---

## Task 5: Papéis

**Files:**
- Create: `src/lib/auth/papeis.ts`
- Test: `src/lib/auth/papeis.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/auth/papeis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { podePapel, rotaInicial, type Papel } from "@/lib/auth/papeis";

describe("papeis", () => {
  it("aceita o papel exigido", () => {
    expect(podePapel("ADMIN", ["ADMIN"])).toBe(true);
    expect(podePapel("ATENDENTE", ["ADMIN", "ATENDENTE"])).toBe(true);
  });

  it("recusa papel fora da lista", () => {
    expect(podePapel("ATENDENTE", ["ADMIN"])).toBe(false);
  });

  it("recusa valor desconhecido vindo do banco", () => {
    expect(podePapel("FAXINEIRO" as Papel, ["ADMIN", "ATENDENTE"])).toBe(false);
  });

  it("manda cada papel para a sua rota inicial", () => {
    expect(rotaInicial("ADMIN")).toBe("/equipe");
    expect(rotaInicial("ATENDENTE")).toBe("/perfil");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/auth/papeis.test.ts
```

Esperado: FAIL — `Failed to resolve import "@/lib/auth/papeis"`.

- [ ] **Step 3: Implementar**

`src/lib/auth/papeis.ts` — módulo puro, sem Prisma e sem `next/*`, para poder ser
testado sem banco e importado de qualquer lugar:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/auth/papeis.test.ts
```

Esperado: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/papeis.ts src/lib/auth/papeis.test.ts
git commit -m "feat: mapa de papeis ADMIN e ATENDENTE"
```

---

## Task 6: Sessão e guards

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/guards.ts`

Sem teste automatizado nesta task: as duas dependem de `next/headers`, que só
existe dentro do request do Next. O comportamento é exercido de ponta a ponta na
Task 9 (login) e na Task 11 (equipe).

- [ ] **Step 1: Criar `src/lib/auth/session.ts`**

```ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "tenka_session";
const DIAS = 7;

export async function criarSessao(userId: string): Promise<void> {
  const expiraEm = new Date(Date.now() + DIAS * 86_400_000);
  const s = await prisma.session.create({ data: { userId, expiraEm } });
  (await cookies()).set(COOKIE, s.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

/**
 * Usuário da requisição atual, ou null.
 * Relê o banco a cada chamada de propósito: desativar um atendente derruba o
 * acesso na hora, sem esperar a sessão expirar.
 */
export async function usuarioAtual() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiraEm < new Date()) return null;
  if (!s.user.ativo) return null;
  return s.user;
}

export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.session.delete({ where: { id } }).catch(() => {});
  jar.delete(COOKIE);
}
```

- [ ] **Step 2: Criar `src/lib/auth/guards.ts`**

```ts
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/session";
import { podePapel, rotaInicial, type Papel } from "@/lib/auth/papeis";

/** Guard de página: sem sessão vai para o login. */
export async function exigirUsuario() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return user;
}

/** Guard de página por papel: quem não tem cai na própria tela inicial. */
export async function exigirPapel(exigidos: Papel[]) {
  const user = await exigirUsuario();
  if (!podePapel(user.role as Papel, exigidos)) redirect(rotaInicial(user.role as Papel));
  return user;
}

/**
 * Guard de rota /api. Uso:
 *   const g = await exigirSessaoApi();
 *   if (g.erro) return g.erro;
 *   // g.user disponível, com g.user.orgId para escopar a query
 */
export async function exigirSessaoApi() {
  const user = await usuarioAtual();
  if (!user) {
    return { user: null as null, erro: NextResponse.json({ erro: "não autenticado" }, { status: 401 }) };
  }
  return { user, erro: null as null };
}

/** Como exigirSessaoApi, mas exige ADMIN. */
export async function exigirAdminApi() {
  const g = await exigirSessaoApi();
  if (g.erro || !g.user) return g;
  if (!podePapel(g.user.role as Papel, ["ADMIN"])) {
    return { user: null as null, erro: NextResponse.json({ erro: "apenas ADMIN" }, { status: 403 }) };
  }
  return g;
}
```

- [ ] **Step 3: Verificar**

```bash
npx tsc --noEmit
```

Esperado: sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/guards.ts
git commit -m "feat: sessao opaca em banco e guards de pagina e api"
```

---

## Task 7: Repositório de usuários com isolamento por empresa

**Files:**
- Create: `src/lib/test/db.ts`, `src/lib/repositories/usuarios.ts`
- Test: `src/lib/repositories/usuarios.test.ts`

- [ ] **Step 1: Criar as fixtures de teste**

`src/lib/test/db.ts` — a ordem do `limparBanco` respeita as chaves estrangeiras:

```ts
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@prisma/client";

export async function limparBanco(): Promise<void> {
  await prisma.atendimentoRegistro.deleteMany();
  await prisma.mensagem.deleteMany();
  await prisma.conversa.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.instancia.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
}

export function criarOrgTeste(slug: string) {
  return prisma.org.create({ data: { slug, nome: slug.toUpperCase() } });
}

export async function criarUsuarioTeste(
  orgId: string,
  login: string,
  role: Role = "ATENDENTE",
) {
  return prisma.user.create({
    data: {
      orgId,
      login,
      nome: login,
      role,
      passwordHash: await hashPassword("senha-de-teste"),
    },
  });
}
```

- [ ] **Step 2: Escrever o teste que falha**

`src/lib/repositories/usuarios.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { limparBanco, criarOrgTeste, criarUsuarioTeste } from "@/lib/test/db";
import {
  listarUsuariosRepo,
  criarUsuarioRepo,
  usuarioDaOrgRepo,
  definirAtivoRepo,
  definirSenhaRepo,
} from "@/lib/repositories/usuarios";

describe("repositório de usuários", () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it("lista só os usuários da própria empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarUsuarioTeste(a.id, "ana");
    await criarUsuarioTeste(b.id, "bruno");

    const lista = await listarUsuariosRepo(a.id);

    expect(lista.map((u) => u.login)).toEqual(["ana"]);
  });

  it("cria usuário na empresa informada, com senha provisória", async () => {
    const a = await criarOrgTeste("empresa-a");

    const criado = await criarUsuarioRepo(a.id, {
      login: "Carla",
      nome: "Carla Souza",
      role: "ADMIN",
      senha: "provisoria-123",
    });

    expect(criado.orgId).toBe(a.id);
    expect(criado.login).toBe("carla"); // normalizado
    expect(criado.senhaProvisoria).toBe(true);
    expect(criado.passwordHash).not.toContain("provisoria-123");
  });

  it("recusa login já em uso", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    await criarUsuarioRepo(a.id, { login: "duplo", nome: "Duplo", role: "ATENDENTE", senha: "x1" });

    await expect(
      criarUsuarioRepo(b.id, { login: "duplo", nome: "Outro", role: "ATENDENTE", senha: "x2" }),
    ).rejects.toThrow("login já em uso");
  });

  it("não devolve usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");

    expect(await usuarioDaOrgRepo(b.id, daA.id)).toBeNull();
    expect(await usuarioDaOrgRepo(a.id, daA.id)).not.toBeNull();
  });

  it("não desativa usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");

    const mexeu = await definirAtivoRepo(b.id, daA.id, false);

    expect(mexeu).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).ativo).toBe(true);
  });

  it("não troca a senha de usuário de outra empresa", async () => {
    const a = await criarOrgTeste("empresa-a");
    const b = await criarOrgTeste("empresa-b");
    const daA = await criarUsuarioTeste(a.id, "ana");
    const antes = (await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash;

    const mexeu = await definirSenhaRepo(b.id, daA.id, "invadida", true);

    expect(mexeu).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash).toBe(antes);
  });

  it("troca a senha dentro da própria empresa e marca provisória", async () => {
    const a = await criarOrgTeste("empresa-a");
    const daA = await criarUsuarioTeste(a.id, "ana");
    const antes = (await prisma.user.findUniqueOrThrow({ where: { id: daA.id } })).passwordHash;

    const mexeu = await definirSenhaRepo(a.id, daA.id, "nova-senha-456", true);

    const depois = await prisma.user.findUniqueOrThrow({ where: { id: daA.id } });
    expect(mexeu).toBe(true);
    expect(depois.passwordHash).not.toBe(antes);
    expect(depois.senhaProvisoria).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
docker compose up -d db
npx vitest run src/lib/repositories/usuarios.test.ts
```

Esperado: FAIL — `Failed to resolve import "@/lib/repositories/usuarios"`.

- [ ] **Step 4: Implementar**

`src/lib/repositories/usuarios.ts` — **todas** as funções recebem `orgId` como
primeiro argumento e o incluem no `where`. Não existe leitura sem escopo:

```ts
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const SELECAO = {
  id: true,
  login: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  senhaProvisoria: true,
  criadoEm: true,
} as const;

export type UsuarioDaLista = Prisma.UserGetPayload<{ select: typeof SELECAO }>;

export function normalizarLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function listarUsuariosRepo(orgId: string): Promise<UsuarioDaLista[]> {
  return prisma.user.findMany({
    where: { orgId },
    select: SELECAO,
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
}

export interface NovoUsuario {
  login: string;
  nome: string;
  role: Role;
  senha: string;
  email?: string | null;
}

export async function criarUsuarioRepo(orgId: string, dados: NovoUsuario) {
  try {
    return await prisma.user.create({
      data: {
        orgId,
        login: normalizarLogin(dados.login),
        nome: dados.nome.trim(),
        email: dados.email?.trim() || null,
        role: dados.role,
        passwordHash: await hashPassword(dados.senha),
        senhaProvisoria: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("login já em uso");
    }
    throw e;
  }
}

/** Null quando o id não existe OU pertence a outra empresa — não confirma existência. */
export function usuarioDaOrgRepo(orgId: string, id: string): Promise<UsuarioDaLista | null> {
  return prisma.user.findFirst({ where: { id, orgId }, select: SELECAO });
}

/** Devolve false quando nada foi alterado (id inexistente ou de outra empresa). */
export async function definirAtivoRepo(orgId: string, id: string, ativo: boolean): Promise<boolean> {
  const r = await prisma.user.updateMany({ where: { id, orgId }, data: { ativo } });
  if (r.count > 0 && !ativo) {
    // Desativar encerra as sessões abertas: o acesso cai na hora.
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  return r.count > 0;
}

export async function definirSenhaRepo(
  orgId: string,
  id: string,
  senha: string,
  provisoria: boolean,
): Promise<boolean> {
  const r = await prisma.user.updateMany({
    where: { id, orgId },
    data: { passwordHash: await hashPassword(senha), senhaProvisoria: provisoria },
  });
  return r.count > 0;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/lib/repositories/usuarios.test.ts
```

Esperado: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/test/db.ts src/lib/repositories/usuarios.ts src/lib/repositories/usuarios.test.ts
git commit -m "feat: repositorio de usuarios escopado por empresa, com teste cross-tenant"
```

---

## Task 8: Seed da primeira empresa e do primeiro admin

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Criar `prisma/seed.ts`**

Idempotente (`upsert`), e falha alto se a senha não vier do ambiente — nunca
existe senha padrão no código:

```ts
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  const slug = (process.env.SEED_ORG_SLUG ?? "tenka").trim();
  const nome = (process.env.SEED_ORG_NOME ?? "Tenka").trim();
  const login = (process.env.SEED_ADMIN_LOGIN ?? "admin").trim().toLowerCase();
  const senha = process.env.SEED_ADMIN_SENHA;

  if (!senha) {
    throw new Error("Defina SEED_ADMIN_SENHA no ambiente antes de rodar o seed.");
  }

  const org = await prisma.org.upsert({
    where: { slug },
    update: { nome },
    create: { slug, nome },
  });

  await prisma.user.upsert({
    where: { login },
    update: {},
    create: {
      orgId: org.id,
      login,
      nome: "Administrador",
      role: "ADMIN",
      passwordHash: await hash(senha),
      senhaProvisoria: true,
    },
  });

  console.log(`Empresa "${org.slug}" e admin "${login}" prontos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rodar o seed**

```bash
npm run db:seed
```

Esperado: `Empresa "tenka" e admin "admin" prontos.`

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed da primeira empresa e do primeiro admin"
```

---

## Task 9: Login e logout

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Create: `src/components/ui/primitives.tsx`, `src/components/ui/Reveal.tsx`
- Create: `src/app/login/page.tsx`, `src/components/login/FormLogin.tsx`

- [ ] **Step 1: Criar as primitivas visuais**

`src/components/ui/primitives.tsx`:

```tsx
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const estilos = {
    primario: "bg-[var(--color-acento)] text-[#04202a] hover:brightness-110",
    secundario: "border border-[var(--color-borda)] text-[var(--color-texto)] hover:bg-[var(--color-superficie)]",
    perigo: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  }[variante];
  return <button className={`${base} ${estilos} ${className}`} {...props} />;
}

export function Campo({
  rotulo,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
        {rotulo}
      </span>
      <input
        className={`w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm outline-none focus:border-[var(--color-acento)] ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-borda)] bg-[var(--color-superficie)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Criar o componente de animação**

`src/components/ui/Reveal.tsx` — `gsap.matchMedia` é o que faz a preferência de
menos movimento ser respeitada de verdade: com ela ativa, o callback nem roda e
o elemento nasce no estado final.

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

interface RevealProps {
  children: ReactNode;
  /** atraso em escada para itens da mesma sequência */
  delay?: number;
  /** deslocamento vertical inicial, em px */
  y?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, y = 18, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, { opacity: 0, y, duration: 0.6, delay, ease: "power3.out" });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [delay, y] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Criar a rota de login**

`src/app/api/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { criarSessao } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { login?: unknown; senha?: unknown };
  const login = typeof corpo.login === "string" ? corpo.login.trim().toLowerCase() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";

  if (!login || !senha) {
    return NextResponse.json({ erro: "informe login e senha" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  const ok = user ? await verifyPassword(user.passwordHash, senha) : false;

  // Mesma mensagem para usuário inexistente, senha errada e conta desativada:
  // não conta a quem tenta qual dos três aconteceu.
  if (!user || !ok || !user.ativo) {
    return NextResponse.json({ erro: "login ou senha inválidos" }, { status: 401 });
  }

  await criarSessao(user.id);
  return NextResponse.json({
    destino: user.senhaProvisoria ? "/perfil" : rotaInicial(user.role as Papel),
  });
}
```

- [ ] **Step 4: Criar a rota de logout**

`src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { destruirSessao } from "@/lib/auth/session";

export async function POST() {
  await destruirSessao();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Criar a tela de login**

`src/components/login/FormLogin.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo } from "@/components/ui/primitives";

export function FormLogin() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha }),
      });
      const data = (await r.json()) as { destino?: string; erro?: string };
      if (!r.ok) {
        setErro(data.erro ?? "não foi possível entrar");
        return;
      }
      router.replace(data.destino ?? "/");
      router.refresh();
    } catch {
      setErro("sem conexão com o servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo
        rotulo="Login"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        autoComplete="username"
        autoFocus
        required
      />
      <Campo
        rotulo="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
        required
      />
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <Botao type="submit" disabled={enviando} className="w-full">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
```

`src/app/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";
import { Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { FormLogin } from "@/components/login/FormLogin";

export default async function LoginPage() {
  const user = await usuarioAtual();
  if (user) redirect(rotaInicial(user.role as Papel));

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <Card>
          <h1 className="mb-1 text-xl font-semibold">Tenka Call</h1>
          <p className="mb-6 text-sm text-[var(--color-fraco)]">Central de atendimento</p>
          <FormLogin />
        </Card>
      </Reveal>
    </main>
  );
}
```

- [ ] **Step 6: Verificar no navegador**

```bash
npm run dev
```

Abra `http://localhost:3000/login`, entre com o login e a senha do seed.
Esperado: redireciona para `/perfil` (o admin do seed tem `senhaProvisoria: true`)
— a rota ainda não existe, então o 404 do Next é o esperado nesta etapa; o que
importa é o cookie `tenka_session` presente no DevTools. Senha errada mostra
"login ou senha inválidos" sem trocar de página.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui src/components/login src/app/login src/app/api/auth
git commit -m "feat: login, logout e primitivas visuais com entrada GSAP"
```

---

## Task 10: Casca autenticada

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/Sidebar.tsx`, `src/components/SairBotao.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Criar a sidebar**

`src/components/Sidebar.tsx` — só links de telas que existem; a Fase 2 acrescenta
Inbox e Instâncias:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/auth/papeis";
import { SairBotao } from "@/components/SairBotao";

const LINKS: { href: string; texto: string; papeis: Papel[] }[] = [
  { href: "/equipe", texto: "Equipe", papeis: ["ADMIN"] },
  { href: "/perfil", texto: "Perfil", papeis: ["ADMIN", "ATENDENTE"] },
];

export function Sidebar({ nome, papel }: { nome: string; papel: Papel }) {
  const atual = usePathname();
  const visiveis = LINKS.filter((l) => l.papeis.includes(papel));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-borda)] p-4">
      <div className="mb-6">
        <p className="text-sm font-semibold">Tenka Call</p>
        <p className="text-xs text-[var(--color-fraco)]">{nome}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {visiveis.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              atual === l.href
                ? "bg-[var(--color-superficie)] text-[var(--color-acento)]"
                : "text-[var(--color-fraco)] hover:bg-[var(--color-superficie)]"
            }`}
          >
            {l.texto}
          </Link>
        ))}
      </nav>
      <SairBotao />
    </aside>
  );
}
```

`src/components/SairBotao.tsx`:

```tsx
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
```

- [ ] **Step 2: Criar o layout autenticado**

`src/app/(app)/layout.tsx`:

```tsx
import { exigirUsuario } from "@/lib/auth/guards";
import { Sidebar } from "@/components/Sidebar";
import type { Papel } from "@/lib/auth/papeis";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await exigirUsuario();

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={user.nome} papel={user.role as Papel} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Criar a raiz que despacha**

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/session";
import { rotaInicial, type Papel } from "@/lib/auth/papeis";

export default async function Home() {
  const user = await usuarioAtual();
  redirect(user ? rotaInicial(user.role as Papel) : "/login");
}
```

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit
```

Esperado: sem erro. (As páginas `/equipe` e `/perfil` chegam nas tasks 11 e 12.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/layout.tsx" src/components/Sidebar.tsx src/components/SairBotao.tsx src/app/page.tsx
git commit -m "feat: casca autenticada com sidebar e despacho da raiz"
```

---

## Task 11: Tela de equipe

**Files:**
- Create: `src/app/api/usuarios/route.ts`, `src/app/api/usuarios/[id]/route.ts`
- Create: `src/app/(app)/equipe/page.tsx`, `src/components/equipe/EquipeView.tsx`

- [ ] **Step 1: Criar as rotas de API**

`src/app/api/usuarios/route.ts` — o `orgId` vem **sempre** da sessão, nunca do corpo:

```ts
import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { listarUsuariosRepo, criarUsuarioRepo } from "@/lib/repositories/usuarios";
import type { Role } from "@prisma/client";

export async function GET() {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;
  return NextResponse.json({ usuarios: await listarUsuariosRepo(g.user.orgId) });
}

export async function POST(req: Request) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const login = typeof corpo.login === "string" ? corpo.login.trim() : "";
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  const role: Role = corpo.role === "ADMIN" ? "ADMIN" : "ATENDENTE";

  if (!login || !nome) return NextResponse.json({ erro: "informe login e nome" }, { status: 400 });
  if (!/^[a-z0-9._-]+$/i.test(login)) {
    return NextResponse.json({ erro: "login aceita letras, números, ponto, _ e -" }, { status: 400 });
  }
  if (senha.length < 8) {
    return NextResponse.json({ erro: "a senha precisa de ao menos 8 caracteres" }, { status: 400 });
  }

  try {
    const criado = await criarUsuarioRepo(g.user.orgId, { login, nome, role, senha });
    return NextResponse.json({ id: criado.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha ao criar";
    return NextResponse.json({ erro: msg }, { status: msg === "login já em uso" ? 409 : 500 });
  }
}
```

`src/app/api/usuarios/[id]/route.ts` — recurso de outra empresa devolve 404, não
403, para não confirmar que ele existe:

```ts
import { NextResponse } from "next/server";
import { exigirAdminApi } from "@/lib/auth/guards";
import { definirAtivoRepo, definirSenhaRepo } from "@/lib/repositories/usuarios";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigirAdminApi();
  if (g.erro) return g.erro;

  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof corpo.ativo === "boolean") {
    if (id === g.user.id && !corpo.ativo) {
      return NextResponse.json({ erro: "não é possível desativar a si mesmo" }, { status: 400 });
    }
    const mexeu = await definirAtivoRepo(g.user.orgId, id, corpo.ativo);
    if (!mexeu) return NextResponse.json({ erro: "usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (typeof corpo.senha === "string") {
    if (corpo.senha.length < 8) {
      return NextResponse.json({ erro: "a senha precisa de ao menos 8 caracteres" }, { status: 400 });
    }
    const mexeu = await definirSenhaRepo(g.user.orgId, id, corpo.senha, true);
    if (!mexeu) return NextResponse.json({ erro: "usuário não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "nada a alterar" }, { status: 400 });
}
```

- [ ] **Step 2: Criar a página**

`src/app/(app)/equipe/page.tsx`:

```tsx
import { exigirPapel } from "@/lib/auth/guards";
import { listarUsuariosRepo } from "@/lib/repositories/usuarios";
import { EquipeView } from "@/components/equipe/EquipeView";

export default async function EquipePage() {
  const user = await exigirPapel(["ADMIN"]);
  const usuarios = await listarUsuariosRepo(user.orgId);

  return (
    <EquipeView
      meuId={user.id}
      usuarios={usuarios.map((u) => ({
        id: u.id,
        login: u.login,
        nome: u.nome,
        role: u.role,
        ativo: u.ativo,
        senhaProvisoria: u.senhaProvisoria,
      }))}
    />
  );
}
```

- [ ] **Step 3: Criar a view**

`src/components/equipe/EquipeView.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo, Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";

export interface UsuarioLinha {
  id: string;
  login: string;
  nome: string;
  role: "ADMIN" | "ATENDENTE";
  ativo: boolean;
  senhaProvisoria: boolean;
}

export function EquipeView({ meuId, usuarios }: { meuId: string; usuarios: UsuarioLinha[] }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"ADMIN" | "ATENDENTE">("ATENDENTE");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, login, senha, role }),
      });
      const data = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(data.erro ?? "falha ao criar");
        return;
      }
      setNome("");
      setLogin("");
      setSenha("");
      setAbrindo(false);
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function alternarAtivo(u: UsuarioLinha) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      if (!r.ok) setErro(((await r.json()) as { erro?: string }).erro ?? "falha ao alterar");
      else router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function resetarSenha(u: UsuarioLinha) {
    const nova = window.prompt(`Nova senha provisória para ${u.nome} (mínimo 8 caracteres):`);
    if (!nova) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: nova }),
      });
      if (!r.ok) setErro(((await r.json()) as { erro?: string }).erro ?? "falha ao alterar");
      else router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipe</h1>
          <p className="text-sm text-[var(--color-fraco)]">Quem pode atender pelo Tenka Call</p>
        </div>
        <Botao onClick={() => setAbrindo((v) => !v)}>
          {abrindo ? "Cancelar" : "+ Novo usuário"}
        </Botao>
      </Reveal>

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {abrindo && (
        <Reveal>
          <Card>
            <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              <Campo rotulo="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
              <Campo
                rotulo="Senha provisória"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                required
              />
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
                  Papel
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "ATENDENTE")}
                  className="w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm outline-none"
                >
                  <option value="ATENDENTE">Atendente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <Botao type="submit" disabled={ocupado}>
                  Criar usuário
                </Botao>
              </div>
            </form>
          </Card>
        </Reveal>
      )}

      <div className="space-y-2">
        {usuarios.map((u, i) => (
          <Reveal key={u.id} delay={i * 0.04}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {u.nome}
                  {!u.ativo && <span className="ml-2 text-xs text-[var(--color-fraco)]">(desativado)</span>}
                  {u.senhaProvisoria && (
                    <span className="ml-2 text-xs text-amber-400">senha provisória</span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-fraco)]">
                  {u.login} · {u.role === "ADMIN" ? "Administrador" : "Atendente"}
                </p>
              </div>
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={() => resetarSenha(u)} disabled={ocupado}>
                  Resetar senha
                </Botao>
                {u.id !== meuId && (
                  <Botao
                    variante={u.ativo ? "perigo" : "secundario"}
                    onClick={() => alternarAtivo(u)}
                    disabled={ocupado}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Botao>
                )}
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar no navegador**

```bash
npm run dev
```

Logado como o admin do seed, abra `http://localhost:3000/equipe`.
Esperado: cria um atendente, ele aparece na lista com "senha provisória",
"Desativar" some no próprio usuário, e desativar alguém tira o acesso dele na
requisição seguinte.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/usuarios "src/app/(app)/equipe" src/components/equipe
git commit -m "feat: tela de equipe com criar, desativar e resetar senha"
```

---

## Task 12: Perfil e troca de senha obrigatória

**Files:**
- Create: `src/app/api/perfil/senha/route.ts`
- Create: `src/app/(app)/perfil/page.tsx`, `src/components/perfil/AlterarSenha.tsx`

- [ ] **Step 1: Criar a rota**

`src/app/api/perfil/senha/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoApi } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { definirSenhaRepo } from "@/lib/repositories/usuarios";

export async function POST(req: Request) {
  const g = await exigirSessaoApi();
  if (g.erro) return g.erro;

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const atual = typeof corpo.atual === "string" ? corpo.atual : "";
  const nova = typeof corpo.nova === "string" ? corpo.nova : "";

  if (nova.length < 8) {
    return NextResponse.json({ erro: "a nova senha precisa de ao menos 8 caracteres" }, { status: 400 });
  }
  if (nova === atual) {
    return NextResponse.json({ erro: "a nova senha precisa ser diferente da atual" }, { status: 400 });
  }

  const dono = await prisma.user.findUniqueOrThrow({ where: { id: g.user.id } });
  if (!(await verifyPassword(dono.passwordHash, atual))) {
    return NextResponse.json({ erro: "senha atual incorreta" }, { status: 400 });
  }

  await definirSenhaRepo(g.user.orgId, g.user.id, nova, false);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Criar o componente**

`src/components/perfil/AlterarSenha.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo, Card } from "@/components/ui/primitives";

export function AlterarSenha({ obrigatoria }: { obrigatoria: boolean }) {
  const router = useRouter();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/perfil/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atual, nova }),
      });
      const data = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: data.erro ?? "falha ao trocar a senha" });
        return;
      }
      setAtual("");
      setNova("");
      setMsg({ tipo: "ok", texto: "senha alterada" });
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold">Alterar senha</h2>
      {obrigatoria && (
        <p className="mb-3 text-xs text-amber-400">
          Sua senha é provisória. Defina uma nova para continuar.
        </p>
      )}
      <form onSubmit={enviar} className="space-y-3">
        <Campo
          rotulo="Senha atual"
          type="password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Campo
          rotulo="Nova senha"
          type="password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        {msg && (
          <p className={`text-sm ${msg.tipo === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {msg.texto}
          </p>
        )}
        <Botao type="submit" disabled={ocupado}>
          Salvar
        </Botao>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Criar a página**

`src/app/(app)/perfil/page.tsx`:

```tsx
import { exigirUsuario } from "@/lib/auth/guards";
import { Card } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { AlterarSenha } from "@/components/perfil/AlterarSenha";

export default async function PerfilPage() {
  const user = await exigirUsuario();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Reveal>
        <h1 className="text-xl font-semibold">Perfil</h1>
      </Reveal>
      <Reveal delay={0.05}>
        <Card>
          <p className="text-sm font-medium">{user.nome}</p>
          <p className="text-xs text-[var(--color-fraco)]">
            {user.login} · {user.role === "ADMIN" ? "Administrador" : "Atendente"}
          </p>
        </Card>
      </Reveal>
      <Reveal delay={0.1}>
        <AlterarSenha obrigatoria={user.senhaProvisoria} />
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 4: Verificar no navegador**

```bash
npm run dev
```

Entre com o admin do seed. Esperado: cai em `/perfil` com o aviso de senha
provisória; após trocar a senha o aviso some; sair e entrar de novo com a senha
nova leva direto para `/equipe`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/perfil "src/app/(app)/perfil" src/components/perfil
git commit -m "feat: perfil com troca de senha e aviso de senha provisoria"
```

---

## Task 13: Build, deploy e documentação

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `railway.json`, `DEPLOY.md`, `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Criar `Dockerfile`**

`node:22-slim` (glibc) em vez de alpine: é a base recomendada pelo Prisma.
Migration **não** roda aqui — roda no `preDeployCommand`, para um container que
reinicia sozinho não tentar migrar o banco em paralelo.

```dockerfile
FROM node:22-slim AS prod

WORKDIR /app

# openssl: exigido pelos engines do Prisma em Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# `next start` respeita o PORT injetado pelo Railway e escuta em 0.0.0.0.
CMD ["npm", "start"]
```

`.dockerignore`:

```
node_modules
.next
.git
.env
.env.local
docs
```

- [ ] **Step 2: Criar `railway.json`**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "preDeployCommand": "npx prisma migrate deploy",
    "healthcheckPath": "/login",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- [ ] **Step 3: Criar `DEPLOY.md`**

````markdown
# Deploy — Tenka Call

## Serviços no Railway

| Serviço | Origem | Exposto |
| --- | --- | --- |
| `tenka-call` | este repositório (Dockerfile) | sim, domínio público |
| `evolution-api` | imagem `evoapicloud/evolution-api:v2.3.7` | **não** |
| `redis` | plugin Redis | não |
| Postgres | plugin Postgres | não |

A Evolution **não** recebe domínio público. O app fala com ela por
`http://evolution-api.railway.internal:8080`.

## Variáveis do serviço `tenka-call`

```
DATABASE_URL=${{Postgres.DATABASE_URL}}?schema=public
EVOLUTION_URL=http://evolution-api.railway.internal:8080
EVOLUTION_API_KEY=<mesma chave do serviço evolution-api>
WHATSAPP_WEBHOOK_SECRET=<segredo aleatório de 32+ caracteres>
PUBLIC_APP_URL=https://<domínio do serviço>
```

## Variáveis do serviço `evolution-api`

```
AUTHENTICATION_API_KEY=<mesma chave do EVOLUTION_API_KEY>
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}?schema=evolution
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=${{Redis.REDIS_URL}}
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_LOCAL_ENABLED=false
```

Adicione um volume em `/evolution/instances`. Sem ele, cada redeploy exige
parear o QR de novo.

## Primeiro acesso

Depois do primeiro deploy, rode uma vez no shell do serviço, com
`SEED_ADMIN_SENHA` definida no ambiente:

```bash
npm run db:seed
```

Entre com o login criado e troque a senha em `/perfil` — ela nasce provisória.

## Migrations

Rodam no `preDeployCommand` (`npx prisma migrate deploy`), antes do container
novo receber tráfego. Nunca rode `migrate dev` contra produção.

## O número de WhatsApp

Use um número **da empresa**, não pessoal. O envio é manual e de volume baixo,
mas qualquer número usado por API carrega risco de bloqueio pelo WhatsApp.
````

- [ ] **Step 4: Criar `AGENTS.md`**

```markdown
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenka Call

- Toda tabela de negócio tem `orgId`. **Nenhuma** função de repositório lê ou
  escreve sem receber `orgId` como primeiro argumento.
- `orgId` vem sempre da sessão (`exigirSessaoApi().user.orgId`). Nunca do corpo,
  da query ou de header.
- Recurso de outra empresa responde **404**, não 403.
- Não existe resposta automática. Nada que rode a partir do webhook pode importar
  o módulo que envia mensagem — há teste de arquitetura garantindo isso.
- Telefone em log sempre redigido (últimos 4 dígitos).
- Animação sempre dentro de `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.
```

- [ ] **Step 5: Atualizar o `README.md`**

Substituir a seção "Estado" por:

```markdown
## Rodando localmente

```bash
docker compose up -d db redis
cp .env.example .env          # defina SEED_ADMIN_SENHA
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Login em `http://localhost:3000/login`.

## Testes

```bash
npm test
```

Os testes de integração usam o Postgres do `docker compose` e limpam as tabelas
entre si — não aponte `DATABASE_URL` para um banco com dados que importam.

## Deploy

Railway, quatro serviços. Ver [DEPLOY.md](DEPLOY.md).

## Estado

Fase 1 (fundação: banco, auth, equipe) concluída. Fase 2 (instâncias, ingestão,
inbox, classificação) a seguir.
```

- [ ] **Step 6: Verificar a suíte inteira e o build**

```bash
npm test
npm run lint
npm run build
```

Esperado: vitest verde (15 testes em 3 arquivos), lint sem erro, `next build`
concluindo com a lista de rotas incluindo `/login`, `/equipe`, `/perfil` e as
rotas `/api/*`.

- [ ] **Step 7: Commit e push**

```bash
git add Dockerfile .dockerignore railway.json DEPLOY.md AGENTS.md README.md
git commit -m "chore: build Docker, config Railway e documentacao de deploy"
git push
```

---

## Critério de pronto da Fase 1

- [ ] `npm test` verde, incluindo os 4 testes cross-tenant do repositório de usuários.
- [ ] `npm run build` conclui.
- [ ] Login funciona; senha errada e conta desativada dão a mesma mensagem.
- [ ] Admin cria atendente, desativa e reseta senha; desativado perde o acesso na requisição seguinte.
- [ ] Senha provisória força a troca no perfil.
- [ ] Tudo commitado e no `main` do `github.com/freelandoo/tenka-call`.
