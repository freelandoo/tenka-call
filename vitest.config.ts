import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Banco DEDICADO aos testes: `.env.test` vence o `.env`. A suíte apaga as tabelas
// entre os casos, então nunca pode tocar o banco de dev/produção.
config({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes de integração compartilham um Postgres só e limpam as tabelas
    // entre si — rodar sequencial evita corrida entre arquivos.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
