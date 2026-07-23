-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "WhatsappStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');

-- CreateEnum
CREATE TYPE "ConversaInteresse" AS ENUM ('nao_classificado', 'com_interesse', 'sem_interesse', 'perdido', 'convertido');

-- CreateEnum
CREATE TYPE "LeadEstagio" AS ENUM ('novo', 'interesse', 'qualificado', 'perdido', 'convertido');

-- CreateEnum
CREATE TYPE "MensagemDirecao" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MensagemAutor" AS ENUM ('LEAD', 'ATENDENTE');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT,
    "nome" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATENDENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "senhaProvisoria" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instancia" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "evolutionInstance" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "WhatsappStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "numeroConectado" TEXT,
    "ultimoEstadoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "ultimos8" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'whatsapp',
    "estagio" "LeadEstagio" NOT NULL DEFAULT 'novo',
    "motivoPerdido" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "pushName" TEXT,
    "leadId" TEXT,
    "atendenteId" TEXT,
    "interesse" "ConversaInteresse" NOT NULL DEFAULT 'nao_classificado',
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaMensagemPreview" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "direcao" "MensagemDirecao" NOT NULL,
    "autor" "MensagemAutor" NOT NULL,
    "autorUserId" TEXT,
    "texto" TEXT NOT NULL,
    "tipoMidia" TEXT NOT NULL DEFAULT 'texto',
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erro" TEXT,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtendimentoRegistro" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interesse" "ConversaInteresse" NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtendimentoRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_ativo_idx" ON "User"("orgId", "ativo");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Instancia_evolutionInstance_key" ON "Instancia"("evolutionInstance");

-- CreateIndex
CREATE INDEX "Instancia_orgId_status_idx" ON "Instancia"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Instancia_orgId_nome_key" ON "Instancia"("orgId", "nome");

-- CreateIndex
CREATE INDEX "Lead_orgId_ultimos8_idx" ON "Lead"("orgId", "ultimos8");

-- CreateIndex
CREATE INDEX "Lead_orgId_estagio_idx" ON "Lead"("orgId", "estagio");

-- CreateIndex
CREATE INDEX "Conversa_orgId_ultimaMensagemEm_idx" ON "Conversa"("orgId", "ultimaMensagemEm");

-- CreateIndex
CREATE INDEX "Conversa_leadId_idx" ON "Conversa"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_instanciaId_remoteJid_key" ON "Conversa"("instanciaId", "remoteJid");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_waMessageId_key" ON "Mensagem"("waMessageId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_enviadaEm_idx" ON "Mensagem"("conversaId", "enviadaEm");

-- CreateIndex
CREATE INDEX "AtendimentoRegistro_conversaId_criadoEm_idx" ON "AtendimentoRegistro"("conversaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instancia" ADD CONSTRAINT "Instancia_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorUserId_fkey" FOREIGN KEY ("autorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoRegistro" ADD CONSTRAINT "AtendimentoRegistro_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoRegistro" ADD CONSTRAINT "AtendimentoRegistro_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoRegistro" ADD CONSTRAINT "AtendimentoRegistro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
