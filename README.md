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

## Documentação

- Design: [docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md](docs/superpowers/specs/2026-07-23-tenka-call-atendimento-design.md)

## Estado

Em construção — design aprovado, implementação começando.
