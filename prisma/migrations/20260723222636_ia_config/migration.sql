-- CreateEnum
CREATE TYPE "IAProvedor" AS ENUM ('claude', 'openai');

-- CreateTable
CREATE TABLE "IAConfig" (
    "id" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "provedor" "IAProvedor",
    "apiKey" TEXT,
    "modelo" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IAConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IAConfig_instanciaId_key" ON "IAConfig"("instanciaId");

-- CreateIndex
CREATE INDEX "IAConfig_orgId_idx" ON "IAConfig"("orgId");

-- AddForeignKey
ALTER TABLE "IAConfig" ADD CONSTRAINT "IAConfig_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
