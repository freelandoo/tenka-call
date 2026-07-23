import "dotenv/config";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

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
