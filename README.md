# Tenka Call

Central de atendimento WhatsApp. Uma empresa conecta um ou mais números, recebe
todas as conversas em um inbox, responde manualmente, classifica o interesse e
registra o atendimento. Quem manda mensagem vira lead automaticamente.

**Sem resposta automática.** Nenhum caminho do código responde a um contato sem
um clique humano — há teste de arquitetura garantindo isso.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma · PostgreSQL ·
Tailwind 4 · GSAP · vitest.

Infra no Railway: o app, `evolution-api` v2.3.7 (sem porta pública), `redis`
(cache de sessão do Baileys) e Postgres — a Evolution em `?schema=evolution`,
o app em `?schema=public`.

## Rodando localmente

```bash
docker compose up -d db redis
cp .env.example .env          # defina SEED_ADMIN_SENHA
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Login em `http://localhost:3000/login`. A senha do admin nasce provisória: o
primeiro acesso cai em `/perfil` pedindo a troca.

## Testes

```bash
npm test
```

Os testes de integração usam o Postgres do `docker compose` e limpam as tabelas
entre si — não aponte `DATABASE_URL` para um banco com dados que importam.

## Documentação

- Design: [docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md](docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md)
- Plano da Fase 1: [docs/superpowers/plans/2026-07-23-tenka-call-fase1-fundacao.md](docs/superpowers/plans/2026-07-23-tenka-call-fase1-fundacao.md)
- Deploy: [DEPLOY.md](DEPLOY.md)

## Estado

Fase 1 (fundação: banco, auth, equipe) concluída. Fase 2 (instâncias, ingestão,
inbox, classificação) a seguir.
