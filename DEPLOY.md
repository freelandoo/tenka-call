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

As três últimas só passam a ser usadas na Fase 2. Sem elas o app sobe normal e
as rotas de WhatsApp devolvem 503.

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
