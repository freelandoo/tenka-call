-- CreateEnum
CREATE TYPE "FechoTipo" AS ENUM ('reuniao', 'link');

-- AlterTable
ALTER TABLE "Conversa" ADD COLUMN     "iaAtiva" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "iaEstagio" TEXT NOT NULL DEFAULT 'saudacao',
ADD COLUMN     "iaInteresse" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "iaMensagens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "objetivo" TEXT,
    "contexto" TEXT,
    "saudacaoAtiva" BOOLEAN NOT NULL DEFAULT true,
    "desenvolvimentoAtiva" BOOLEAN NOT NULL DEFAULT true,
    "agendamentoAtiva" BOOLEAN NOT NULL DEFAULT true,
    "fecho" "FechoTipo" NOT NULL DEFAULT 'reuniao',
    "linkFecho" TEXT,
    "maxMensagensAuto" INTEGER NOT NULL DEFAULT 8,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookServico" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaybookServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Playbook_instanciaId_key" ON "Playbook"("instanciaId");

-- CreateIndex
CREATE INDEX "Playbook_orgId_idx" ON "Playbook"("orgId");

-- CreateIndex
CREATE INDEX "PlaybookServico_playbookId_idx" ON "PlaybookServico"("playbookId");

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookServico" ADD CONSTRAINT "PlaybookServico_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
