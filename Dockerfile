# node:22-slim (glibc) em vez de alpine: é a base recomendada pelo Prisma.
# Versão EXATA do Node (segurança): etiqueta solta pegava o patch em cache do Railway. 22.23.4 = release de segurança de 2026-10-20.
FROM node:22.23.4-slim AS prod

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
# Migrations NÃO rodam aqui — ver preDeployCommand no railway.json.
CMD ["npm", "start"]
